import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ASSUMPTIONS } from '#engine/assumptions.ts';

import { checkAssumptions } from './assumptions.ts';
import { checkFolder, checkHooks, checkView } from './components.ts';
import { findIdLiterals } from './engineIds.ts';
import { checkPackage } from './packages.ts';
import { filesIn, readJson, readText } from './repo.ts';

type Manifest = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly devEngines?: { readonly runtime: { readonly version: string } };
};

type TsConfig = { readonly references?: readonly { readonly path: string }[] };

type LibraryFile = { readonly items: readonly { readonly id: string }[] };

const ITEM_FOLDERS = 'packages/data/library/{weapons,mods,arcanes,buffs,enemies,stances}/**/*.json';

const packages = filesIn('packages/*/package.json').map((file) => file.split('/')[1] ?? '');

/** A component is a PascalCase folder of the app. */
const components = filesIn('packages/app/src/**/[A-Z]*/').map((folder) => ({
  folder,
  name: path.basename(folder),
  entries: filesIn(`${folder}/*`).map((entry) => path.basename(entry)),
}));

const manifestOf = (file: string) => readJson(file) as Manifest;

const dependenciesOf = (name: string) => {
  const { dependencies, devDependencies } = manifestOf(`packages/${name}/package.json`);
  return Object.keys({ ...dependencies, ...devDependencies })
    .filter((dependency) => dependency.startsWith('@abacus/'))
    .map((dependency) => dependency.slice('@abacus/'.length));
};

const referencesOf = (name: string) =>
  filesIn(`packages/${name}/tsconfig*.json`)
    .flatMap((file) => (readJson(file) as TsConfig).references ?? [])
    .filter((reference) => reference.path.startsWith('../'))
    .map((reference) => path.basename(reference.path));

describe('packages', () => {
  it.each(packages)('%s depends only on its left', (name) => {
    expect(checkPackage(name, [...dependenciesOf(name), ...referencesOf(name)])).toEqual([]);
  });
});

describe('components', () => {
  it('are found', () => {
    expect(components.map(({ name }) => name)).toContain('App');
  });

  it.each(components)('$folder follows the component rules', ({ folder, name, entries }) => {
    const read = (file: string) => readText(`${folder}/${file}`);
    const hooks = `${name}.hooks.ts`;
    expect([
      ...checkFolder(name, entries),
      ...checkView(name, read(`${name}.tsx`)),
      ...(entries.includes(hooks) ? checkHooks(name, read(hooks)) : []),
    ]).toEqual([]);
  });

  it('hold every .tsx file of the app', () => {
    const folders = new Set(components.map(({ folder }) => path.normalize(folder)));
    const strays = filesIn('packages/app/src/**/*.tsx').filter(
      (file) => !folders.has(path.dirname(file)),
    );
    expect(strays).toEqual([]);
  });
});

describe('the engine', () => {
  const ids = new Set(
    filesIn(ITEM_FOLDERS).flatMap((file) =>
      (readJson(file) as LibraryFile).items.map(({ id }) => id),
    ),
  );
  const files = filesIn('packages/engine/src/**/*.ts').filter(
    (file) => !file.startsWith('packages/engine/src/hooks/') && !file.endsWith('.test.ts'),
  );

  it.each(files)('%s names no item', (file) => {
    expect(findIdLiterals(readText(file), ids)).toEqual([]);
  });

  it('cites a test and a BIBLE section for every assumption', () => {
    expect(checkAssumptions(ASSUMPTIONS)).toEqual([]);
  });
});

describe('the toolchain', () => {
  it('pins one Node version', () => {
    const { devEngines } = manifestOf('package.json');
    expect(readText('.nvmrc').trim()).toBe(devEngines?.runtime.version);
  });
});
