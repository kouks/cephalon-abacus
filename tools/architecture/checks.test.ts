import { describe, expect, it } from 'vitest';

import { checkAssumptions } from './assumptions.ts';
import { checkFolder, checkHooks, checkView } from './components.ts';
import { findIdLiterals } from './engineIds.ts';
import { checkPackage } from './packages.ts';

describe('checkFolder', () => {
  it('accepts the five files of a component', () => {
    const suffixes = ['.tsx', '.hooks.ts', '.css.ts', '.test.tsx', '.stories.tsx'];
    expect(
      checkFolder(
        'Foo',
        suffixes.map((suffix) => `Foo${suffix}`),
      ),
    ).toEqual([]);
  });

  it.each([
    ['a helper', ['Foo.tsx', 'helpers.ts']],
    ['another component', ['Foo.tsx', 'Bar.tsx']],
    ['a subfolder', ['Foo.tsx', 'Bar']],
    ['no view', ['Foo.hooks.ts']],
  ])('refuses %s', (_name, entries) => {
    expect(checkFolder('Foo', entries)).toHaveLength(1);
  });
});

describe('checkView', () => {
  it('accepts a view that calls its own hook once', () => {
    const code = `export type FooProps = { a: 1 };
      export const Foo = (props: FooProps) => { const { b } = useFoo(props); return <p>{b}</p>; };`;
    expect(checkView('Foo', code)).toEqual([]);
  });

  it.each([
    ['another export', 'export const Foo = () => null; export const helper = 1;'],
    ['another type', 'export const Foo = () => null; export type Other = 1;'],
    ['an export list', 'const a = 1; export const Foo = () => null; export { a };'],
    ['no component', 'const Foo = () => null;'],
    ['useState', 'export const Foo = () => { useState(1); return null; };'],
    ['React.useState', 'export const Foo = () => { React.useState(1); return null; };'],
    ['use', 'export const Foo = () => { use(promise); return null; };'],
    ['its hook twice', 'export const Foo = () => { useFoo(); useFoo(); return null; };'],
  ])('refuses %s', (_name, code) => {
    expect(checkView('Foo', code)).toHaveLength(1);
  });
});

describe('checkHooks', () => {
  it.each([
    'export const useFoo = () => ({ a: 1 });',
    'export type A = 1; export const useFoo = () => ({ a: 1 });',
  ])('accepts %s', (code) => {
    expect(checkHooks('Foo', code)).toEqual([]);
  });

  it.each([
    'export const useBar = () => 1;',
    'export const useFoo = () => 1; export const useBar = () => 1;',
    'export const useFoo = () => 1; export const helper = 1;',
    'export const useFoo = () => 1; export function helper() { return 1; }',
    'const useFoo = () => 1;',
    'const useFoo = () => 1; export default useFoo;',
  ])('refuses %s', (code) => {
    expect(checkHooks('Foo', code)).toHaveLength(1);
  });
});

describe('findIdLiterals', () => {
  const library = new Set(['kohm', 'serration']);

  it.each([
    "if (weapon.id === 'vectis') skip();",
    "if ('vectis' !== weapon.id) skip();",
    "const is = weaponId == 'vectis';",
    "switch (mod.id) { case 'vectis': skip(); }",
    "const special = ['kohm'];",
    'const special = `serration`;',
  ])('finds %s', (code) => {
    expect(findIdLiterals(code, library)).toHaveLength(1);
  });

  it.each([
    "if (attack.trigger === 'charge') skip();",
    "const bucket = 'damage.base';",
    'const item = byId.get(weapon.id);',
    'const same = a.id === b.id;',
    "const grid = width === 'wide';",
  ])('allows %s', (code) => {
    expect(findIdLiterals(code, library)).toEqual([]);
  });
});

describe('checkAssumptions', () => {
  it('accepts a flag that cites a test and a section', () => {
    const flags = { coldIsAbsolute: { default: true, test: 'T-5', bible: '§7' } } as const;
    expect(checkAssumptions(flags)).toEqual([]);
  });

  it('refuses a malformed test and section', () => {
    const flags = { coldIsAbsolute: { default: true, test: 'T-0.5', bible: '§-7' } } as const;
    expect(checkAssumptions(flags)).toEqual([
      'coldIsAbsolute cites "T-0.5", which is not a test like T-5.',
      'coldIsAbsolute cites "§-7", which is not a section like §7.',
    ]);
  });
});

describe('checkPackage', () => {
  it('accepts packages to the left', () => {
    expect(checkPackage('app', ['data', 'engine'])).toEqual([]);
  });

  it.each([
    ['data', 'engine'],
    ['engine', 'app'],
    ['importers', 'engine'],
  ])('refuses %s depending on %s', (name, used) => {
    expect(checkPackage(name, [used])).toHaveLength(1);
  });

  it('refuses a package without a layer', () => {
    expect(checkPackage('shared', [])).toHaveLength(1);
  });
});
