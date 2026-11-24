import { describe, expect, it } from 'vitest';

import type { Banned } from './lintVirtual.ts';
import { lintTyped, lintVirtual, valueFrom } from './lintVirtual.ts';

const DATA = 'packages/data/src/virtual.ts';
const TEST = 'packages/data/src/virtual.test.ts';
const STORY = 'packages/app/src/Foo/Foo.stories.tsx';
const VIEW = 'packages/app/src/Foo/Foo.tsx';
const ON_DISK = 'packages/data/src/assert.ts';

const SYNTAX = 'no-restricted-syntax';
const IMPORTS = '@typescript-eslint/no-restricted-imports';
const WHITESPACE = 'no-irregular-whitespace';

const NBSP = String.fromCharCode(0xa0);

const BANNED: readonly Banned[] = [
  ['an enum', DATA, 'export enum A { B }', SYNTAX],
  ['export *', DATA, "export * from './a';", SYNTAX],
  ['a value re-export', DATA, "export { a } from './a';", SYNTAX],
  ['a function expression', DATA, 'export const f = function () { return 1; };', SYNTAX],
  ['a function declaration', DATA, 'export function f() { return 1; }', 'func-style'],
  ['a default export', DATA, 'const a = 1; export default a;', 'import-x/no-default-export'],
  ['==', DATA, 'export const f = (a: number) => a == 1;', 'eqeqeq'],
  ['a no-break space in a string', DATA, `export const a = '${NBSP}';`, WHITESPACE],
  ['a no-break space in a template', DATA, 'export const a = `' + NBSP + '`;', WHITESPACE],
  ['a no-break space in a comment', DATA, `// ${NBSP}\nexport const a = 1;`, WHITESPACE],
  ['a path two levels up', DATA, valueFrom('../../a'), IMPORTS],
  ['a path two levels up, split', DATA, valueFrom('../x/../../a'), IMPORTS],
];

const BANNED_TYPESCRIPT: readonly Banned[] = [
  ['any', DATA, 'export type A = any;', 'no-explicit-any'],
  ['a non-null !', DATA, 'export const f = (a?: { b: 1 }) => a!.b;', 'no-non-null-assertion'],
  ['an interface', DATA, 'export interface A { b: 1 }', 'consistent-type-definitions'],
  ['a cast object', DATA, 'export const a = {} as { b: 1 };', 'consistent-type-assertions'],
  [
    'a value import of a type',
    DATA,
    "import { A } from './a'; export type B = A;",
    'consistent-type-imports',
  ],
];

const CONDITIONAL_HOOK = `
import { useFoo } from './Foo.hooks';
export const Foo = ({ isOn }: { isOn: boolean }) => {
  if (isOn) useFoo();
  return null;
};`;

describe('banned patterns', () => {
  it.each(BANNED)('%s', async (...[, file, code, rule]) => {
    expect(await lintVirtual(file, code)).toContain(rule);
  });

  it.each(BANNED_TYPESCRIPT)('%s', async (...[, file, code, rule]) => {
    expect(await lintVirtual(file, code)).toContain(`@typescript-eslint/${rule}`);
  });

  it('a conditional hook', async () => {
    expect(await lintVirtual(VIEW, CONDITIONAL_HOOK)).toContain('react-hooks/rules-of-hooks');
  });
});

describe('banned patterns that need types or other files', () => {
  it('a floating promise', async () => {
    const code = 'export const f = () => { Promise.resolve(1); };';
    expect(await lintTyped(ON_DISK, code)).toContain('@typescript-eslint/no-floating-promises');
  });

  it('a switch that misses a case, even with a default', async () => {
    const code = `export const f = (a: 'x' | 'y') => {
      switch (a) { case 'x': return 1; default: return 2; }
    };`;
    const rule = '@typescript-eslint/switch-exhaustiveness-check';
    expect(await lintTyped(ON_DISK, code)).toContain(rule);
  });

  it.each(['./assert.test', '@/assert.test'])('an import cycle through %s', async (path) => {
    expect(await lintTyped(ON_DISK, valueFrom(path))).toContain('import-x/no-cycle');
  });
});

const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => `export const a${index} = ${index};`).join('\n');

const body = (count: number) => `export const f = () => {\n${'// line\n'.repeat(count - 2)}};`;

const branches = (count: number) =>
  `export const f = (a: number) => {\n${'if (a > 1) return;\n'.repeat(count)}};`;

const depth = (count: number) =>
  `export const f = (a: number) => { ${'if (a > 1) { '.repeat(count)} ${'}'.repeat(count)} };`;

const callbacks = (count: number) => `${'f(() => '.repeat(count)}1${')'.repeat(count)};`;

const parameters = (count: number) =>
  `export const f = (${Array.from({ length: count }, (_, i) => `a${i}: 1`).join(', ')}) => 1;`;

describe('size and complexity limits', () => {
  it.each([
    ['lines in a file', DATA, lines, 150, 'max-lines'],
    ['lines in a test', TEST, lines, 300, 'max-lines'],
    ['lines in a story', STORY, lines, 200, 'max-lines'],
    ['lines in a function', DATA, body, 40, 'max-lines-per-function'],
    ['cyclomatic complexity', DATA, (n: number) => branches(n - 1), 8, 'complexity'],
    ['nesting depth', DATA, depth, 3, 'max-depth'],
    ['parameters', DATA, parameters, 3, 'max-params'],
    ['nested callbacks', DATA, callbacks, 3, 'max-nested-callbacks'],
  ] as const)('%s', async (...[, file, code, limit, rule]) => {
    expect(await lintVirtual(file, code(limit))).not.toContain(rule);
    expect(await lintVirtual(file, code(limit + 1))).toContain(rule);
  });

  it('leaves the length of a test function alone', async () => {
    expect(await lintVirtual(TEST, body(60))).not.toContain('max-lines-per-function');
  });
});

describe('well-formed code', () => {
  it.each([
    ['a constant object and its union', "export const A = { b: 'b' } as const;"],
    ['an arrow function', 'export const f = (a: number) => a + 1;'],
    ['a type re-export', "export type { A } from './a';"],
    ['one level up', valueFrom('../a')],
    ['an alias', valueFrom('@/build/a')],
    ['an escaped no-break space', "export const a = '\\u00a0';"],
  ])('%s passes', async (_name, code) => {
    expect(await lintVirtual(DATA, code)).toEqual([]);
  });

  it.each(['vite.config.ts', STORY])('%s may have a default export', async (file) => {
    expect(await lintVirtual(file, 'const a = 1; export default a;')).toEqual([]);
  });
});
