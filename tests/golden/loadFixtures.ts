import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { formatError } from '@abacus/data/load/libraryError';
import { loadLibrary } from '@abacus/data/load/loadLibrary';
import type { GoldenFixture } from '@abacus/data/schema/goldenFixture';
import { goldenFixtureSchema } from '@abacus/data/schema/goldenFixture';

import { readLibrary } from '#tools/data/readLibrary.ts';

export type FixtureFile = { readonly file: string; readonly fixture: GoldenFixture };

/** Every fixture on disk: T-<n>-<topic>.json. */
export const loadFixtures = (): readonly FixtureFile[] =>
  globSync('*.json', { cwd: import.meta.dirname })
    .sort()
    .map((file) => {
      const text = readFileSync(path.join(import.meta.dirname, file), 'utf8');
      const parsed = goldenFixtureSchema.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error(`${file}: ${parsed.error.message}`);
      return { file, fixture: parsed.data };
    });

type Brought = {
  readonly path: string;
  readonly source: string;
  readonly items: readonly object[];
};

/** Library files with what the fixture brings. */
const filesOf = ({ modules = [], weapons = [], gameVersion }: GoldenFixture) => {
  const brought: readonly Brought[] = [
    { path: 'mods/fixture.json', source: 'https://wiki.warframe.com/w/Riven_Mods', items: modules },
    { path: 'weapons/fixture.json', source: 'https://wiki.warframe.com/w/Weapons', items: weapons },
  ];
  return brought
    .filter(({ items }) => items.length > 0)
    .map(({ path: file, source, items }) => ({
      path: file,
      text: JSON.stringify({ schemaVersion: 1, gameVersion, source, items }),
    }));
};

/** The real library, with the modules and weapons that a fixture brings. */
export const libraryWith = (fixture: GoldenFixture) => {
  const loaded = loadLibrary([...readLibrary(), ...filesOf(fixture)]);
  if (!loaded.ok) throw new Error(loaded.errors.map(formatError).join('\n'));
  return loaded.library;
};
