import { describe, expect, it } from 'vitest';

import type { Banned } from './lintVirtual.ts';
import { lintVirtual, typeFrom, valueFrom } from './lintVirtual.ts';

const DATA = 'packages/data/src/virtual.ts';
const ENGINE = 'packages/engine/src/virtual.ts';
const IMPORTER = 'packages/importers/src/virtual.ts';
const APP = 'packages/app/src/lib/virtual.ts';
const APP_VIEW = 'packages/app/src/Foo/Foo.tsx';
const APP_ENGINE = 'packages/app/src/engine/bridge.ts';
const APP_THEME = 'packages/app/src/theme/colours.ts';
const GOLDEN = 'tests/golden/virtual.ts';

const SYNTAX = 'no-restricted-syntax';
const IMPORTS = '@typescript-eslint/no-restricted-imports';
const LAYERS = 'architecture/layers';
const NAME = 'check-file/filename-naming-convention';
const FOLDER = 'check-file/folder-match-with-fex';

const LAZY_ENGINE = "export const a = import('@abacus/engine');";
const INVALID = 'export const Foo = () => <input isInvalid={false} />;';

const BANNED: readonly Banned[] = [
  ['engine importing app', ENGINE, valueFrom('@abacus/app/a'), LAYERS],
  ['data importing engine', DATA, valueFrom('@abacus/engine'), LAYERS],
  ['data importing engine types', DATA, typeFrom('@abacus/engine'), LAYERS],
  ['data re-exporting an engine type', DATA, "export type { A } from '@abacus/engine';", LAYERS],
  ['data loading engine lazily', DATA, LAZY_ENGINE, LAYERS],
  [
    'data naming an engine type inline',
    DATA,
    "export type A = import('@abacus/engine').A;",
    LAYERS,
  ],
  ['importers importing engine', IMPORTER, valueFrom('@abacus/engine'), LAYERS],
  ['importers importing app', IMPORTER, valueFrom('@abacus/app/a'), LAYERS],
  ['app importing importers', APP, valueFrom('@abacus/importers/a'), LAYERS],
  ['a relative path into a package', 'packages/data/a.config.ts', valueFrom('../engine/a'), LAYERS],
  ['a package importing itself by name', DATA, valueFrom('@abacus/data/a'), LAYERS],

  ['the app running the engine', APP, valueFrom('@abacus/engine', 'evaluate'), IMPORTS],
  ['the app loading the engine lazily', APP, LAZY_ENGINE, SYNTAX],
  ['a fixture using another export', GOLDEN, valueFrom('@abacus/engine', 'quantize'), IMPORTS],
  ['a fixture reaching past the API', GOLDEN, valueFrom('#engine/api.ts', 'evaluate'), IMPORTS],
  ['two levels up in the app', APP, valueFrom('../../a'), IMPORTS],
  ['two levels up in a fixture', GOLDEN, valueFrom('../../a'), IMPORTS],
  ['an enum in the app', APP, 'export enum A { B }', SYNTAX],
  ['an enum in the theme', APP_THEME, 'export enum A { B }', SYNTAX],

  ['a hex colour', APP, "export const a = '#ff0000';", SYNTAX],
  ['a short hex colour', APP, "export const a = '#f00';", SYNTAX],
  ['rgb()', APP, "export const a = 'rgb(0 0 0)';", SYNTAX],
  ['hsl() in a template', APP, 'export const f = (h: number) => `hsl(${h} 50% 50%)`;', SYNTAX],
  ['isInvalid={false}', APP_VIEW, INVALID, SYNTAX],

  ['an index file', 'packages/data/src/index.ts', 'export const a = 1;', 'check-file/no-index'],
  ['a camelCase .tsx', 'packages/app/src/Foo/foo.tsx', 'export const Foo = () => null;', NAME],
  ['a PascalCase .ts', 'packages/engine/src/Foo.ts', 'export const a = 1;', NAME],
  ['a kebab-case .ts', 'packages/engine/src/foo-bar.ts', 'export const a = 1;', NAME],
  ['a camelCase hooks file', 'packages/app/src/Foo/foo.hooks.ts', 'export const a = 1;', NAME],
  ['hooks outside a component', 'packages/app/src/lib/Foo.hooks.ts', 'export const a = 1;', FOLDER],
  [
    'a story outside a component',
    'packages/app/src/lib/Foo.stories.tsx',
    'export const A = {};',
    FOLDER,
  ],
];

describe('banned across boundaries', () => {
  it.each(BANNED)('%s', async (...[, file, code, rule]) => {
    expect(await lintVirtual(file, code)).toContain(rule);
  });
});

describe('well-formed code', () => {
  it.each([
    ['engine importing data', ENGINE, valueFrom('@abacus/data/assert')],
    ['importers importing data', IMPORTER, valueFrom('@abacus/data/assert')],
    ['app importing data', APP, valueFrom('@abacus/data/assert')],
    ['app importing engine types', APP, typeFrom('@abacus/engine')],
    ['the bridge running the engine', APP_ENGINE, valueFrom('@abacus/engine', 'evaluate')],
    ['a fixture calling evaluate', GOLDEN, valueFrom('@abacus/engine', 'evaluate')],
    ['a fixture calling simulate', GOLDEN, valueFrom('@abacus/engine', 'simulate')],
    ['a fixture naming an engine type', GOLDEN, typeFrom('@abacus/engine')],
    ['a colour in the theme', APP_THEME, "export const a = '#ff0000';"],
    ['a fragment link', APP, "export const a = '#results';"],
    ['a component', APP_VIEW, 'export const Foo = () => <p>Foo</p>;'],
    ['its hook', 'packages/app/src/Foo/Foo.hooks.ts', 'export const useFoo = () => 1;'],
    ['its styles', 'packages/app/src/Foo/Foo.css.ts', 'export const root = 1;'],
    ['its test', 'packages/app/src/Foo/Foo.test.tsx', 'export const a = 1;'],
    ['a camelCase module', 'packages/engine/src/build/combineElements.ts', 'export const a = 1;'],
  ])('%s passes', async (_name, file, code) => {
    expect(await lintVirtual(file, code)).toEqual([]);
  });
});
