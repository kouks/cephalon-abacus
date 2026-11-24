import { describe, expect, it } from 'vitest';

import type { Banned } from './lintVirtual.ts';
import { lintVirtual, typeFrom, valueFrom } from './lintVirtual.ts';

const DATA = 'packages/data/src/virtual.ts';
const DATA_TEST = 'packages/data/src/virtual.test.ts';
const ENGINE = 'packages/engine/src/build/virtual.ts';
const ENGINE_TEST = 'packages/engine/src/build/virtual.test.ts';
const IMPORTER = 'packages/importers/src/virtual.ts';

const IMPORTS = '@typescript-eslint/no-restricted-imports';
const GLOBALS = 'no-restricted-globals';
const PROPERTIES = 'no-restricted-properties';

const BANNED: readonly Banned[] = [
  ['React in the engine', ENGINE, valueFrom('react'), IMPORTS],
  ['React types in the engine', ENGINE, typeFrom('react'), IMPORTS],
  ['react-dom in the engine', ENGINE, valueFrom('react-dom/client'), IMPORTS],
  ['React Aria in the engine', ENGINE, valueFrom('react-aria-components'), IMPORTS],
  ['React in an engine test', ENGINE_TEST, valueFrom('react'), IMPORTS],
  ['Node in the engine', ENGINE, valueFrom('node:fs'), IMPORTS],
  ['Node without its prefix in the engine', ENGINE, valueFrom('fs'), IMPORTS],
  ['Vitest outside an engine test', ENGINE, valueFrom('vitest'), IMPORTS],
  ['zod in the engine', ENGINE, valueFrom('zod'), IMPORTS],
  ['React in the data library', DATA, valueFrom('react'), IMPORTS],
  ['Node in the data library', DATA, valueFrom('node:fs'), IMPORTS],
  ['a package whose name starts like zod', DATA, valueFrom('zod-extra'), IMPORTS],
  ['two levels up in the engine', ENGINE, valueFrom('../../a'), IMPORTS],
  ['document', ENGINE, 'export const a = document.title;', GLOBALS],
  ['window', ENGINE, 'export const a = window;', GLOBALS],
  ['fetch', DATA, "export const a = fetch('/');", GLOBALS],
  ['process', ENGINE, 'export const a = process.env;', GLOBALS],
  ['Date.now', ENGINE, 'export const a = Date.now();', GLOBALS],
  ['new Date', DATA, 'export const a = new Date();', GLOBALS],
  ['performance', ENGINE, 'export const a = performance.now();', GLOBALS],
  ['setTimeout', ENGINE, 'setTimeout(() => 1, 1);', GLOBALS],
  ['crypto', ENGINE, 'export const a = crypto.randomUUID();', GLOBALS],
  ['console', ENGINE, 'console.log(1);', GLOBALS],
  ['globalThis', ENGINE, 'export const a = globalThis;', GLOBALS],
  ['Math.random', ENGINE, 'export const a = Math.random();', PROPERTIES],
  ['Math.random, destructured', DATA, 'export const { random } = Math;', PROPERTIES],
];

describe('banned in the engine and the data library', () => {
  it.each(BANNED)('%s', async (...[, file, code, rule]) => {
    expect(await lintVirtual(file, code)).toContain(rule);
  });
});

describe('well-formed code', () => {
  it.each([
    ['the engine importing the data library', ENGINE, valueFrom('@abacus/data/assert')],
    ['the engine importing itself', ENGINE, valueFrom('@/trace/record')],
    ['the engine importing a sibling', ENGINE, valueFrom('./a')],
    ['the engine doing arithmetic', ENGINE, 'export const a = Math.floor(1.5);'],
    ['a local named like a global', ENGINE, 'export const f = (status: number) => status;'],
    ['an engine test', ENGINE_TEST, valueFrom('vitest', 'it')],
    ['a property test', ENGINE_TEST, valueFrom('fast-check', 'sample')],
    ['the data library using zod', DATA, valueFrom('zod', 'z')],
    ['a data test', DATA_TEST, valueFrom('vitest', 'it')],
    ['an importer reading files', IMPORTER, valueFrom('node:fs')],
    ['an importer reading the clock', IMPORTER, 'export const a = Date.now();'],
  ])('%s passes', async (_name, file, code) => {
    expect(await lintVirtual(file, code)).toEqual([]);
  });
});
