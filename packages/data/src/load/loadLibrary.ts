import { bucketSchema } from '@/schema/bucket';
import { damageTypeRuleSchema } from '@/schema/damageTypeRule';
import type { Enemy } from '@/schema/enemy';
import { enemySchema } from '@/schema/enemy';
import { factionSchema } from '@/schema/faction';
import { moduleSchema } from '@/schema/module';
import { weaponSchema } from '@/schema/weapon';

import { checkDamageTypes } from './checkDamageTypes';
import { checkModuleEffects, checkWeaponEffects } from './checkEffects';
import type { Library, Reference } from './library';
import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import {
  BUCKETS_FILE,
  DAMAGE_TYPES_FILE,
  describePlaces,
  ENEMY_FOLDERS,
  FACTIONS_FILE,
  filesAt,
  missingFrom,
  MODULE_FOLDERS,
  REFERENCE_FILES,
  straysIn,
  WEAPON_FOLDERS,
} from './places';
import type { LibraryFile, Located } from './readItems';
import { readItems } from './readItems';
import { findDuplicateIds } from './uniqueIds';

export type LoadResult =
  | { readonly ok: true; readonly library: Library }
  | { readonly ok: false; readonly errors: readonly LibraryError[] };

const read = (files: readonly LibraryFile[]) => ({
  damageTypes: readItems(damageTypeRuleSchema, filesAt(files, [DAMAGE_TYPES_FILE])),
  buckets: readItems(bucketSchema, filesAt(files, [BUCKETS_FILE])),
  factions: readItems(factionSchema, filesAt(files, [FACTIONS_FILE])),
  weapons: readItems(weaponSchema, filesAt(files, WEAPON_FOLDERS)),
  modules: readItems(moduleSchema, filesAt(files, MODULE_FOLDERS)),
  enemies: readItems(enemySchema, filesAt(files, ENEMY_FOLDERS)),
});

type Read = ReturnType<typeof read>;

const byId = <Item extends { readonly id: string }>(located: readonly Located<Item>[]) =>
  new Map<Item['id'], Item>(located.map(({ item }) => [item.id, item]));

const toLibrary = (found: Read): Library => ({
  damageTypes: byId(found.damageTypes.items),
  buckets: byId(found.buckets.items),
  factions: byId(found.factions.items),
  weapons: byId(found.weapons.items),
  modules: byId(found.modules.items),
  enemies: byId(found.enemies.items),
});

/** What is wrong with the files one by one. */
const checkFiles = (files: readonly LibraryFile[], found: Read): readonly LibraryError[] => [
  ...straysIn(files).map(({ path }) =>
    errorAt(path, [], `No schema for this file. Places: ${describePlaces()}`),
  ),
  ...missingFrom(files).map((path) => errorAt(path, [], 'The library needs this file')),
  ...Object.values(found).flatMap(({ items, errors }) => [...errors, ...findDuplicateIds(items)]),
];

const checkFactions = (enemies: readonly Located<Enemy>[], { factions }: Reference) =>
  enemies
    .filter(({ item }) => !factions.has(item.faction))
    .map(({ item, file, index }) =>
      errorAt(
        file,
        ['items', index, 'faction'],
        `"${item.faction}" is not a faction (factions.json)`,
      ),
    );

/** What is wrong between files. Pointless while the reference files have errors of their own. */
const checkReferences = (found: Read, library: Library): readonly LibraryError[] => [
  ...checkDamageTypes(found.damageTypes.items),
  ...checkWeaponEffects(found.weapons.items, library),
  ...checkModuleEffects(found.modules.items, library),
  ...checkFactions(found.enemies.items, library),
];

/**
 * Validates library files and indexes their items by id. It collects every error, and returns a
 * library only when there are none. Reading the files is up to the caller.
 */
export const loadLibrary = (files: readonly LibraryFile[]): LoadResult => {
  const found = read(files);
  const library = toLibrary(found);
  const inFiles = checkFiles(files, found);
  const isReferenceSound = !inFiles.some(({ file }) => REFERENCE_FILES.includes(file));

  const errors = [...inFiles, ...(isReferenceSound ? checkReferences(found, library) : [])];
  return errors.length > 0 ? { ok: false, errors } : { ok: true, library };
};
