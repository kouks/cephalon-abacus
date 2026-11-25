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

/** The real library, with the modules that a fixture brings. */
export const libraryWith = ({ modules = [], gameVersion }: GoldenFixture) => {
  const extra = {
    path: 'mods/fixture.json',
    text: JSON.stringify({
      schemaVersion: 1,
      gameVersion,
      source: 'https://wiki.warframe.com/w/Riven_Mods',
      items: modules,
    }),
  };
  const loaded = loadLibrary([...readLibrary(), ...(modules.length > 0 ? [extra] : [])]);
  if (!loaded.ok) throw new Error(loaded.errors.map(formatError).join('\n'));
  return loaded.library;
};
