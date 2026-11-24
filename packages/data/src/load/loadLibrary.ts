import type { Enemy } from '@/schema/enemy';
import { enemySchema } from '@/schema/enemy';
import type { Module } from '@/schema/module';
import { moduleSchema } from '@/schema/module';
import type { Weapon } from '@/schema/weapon';
import { weaponSchema } from '@/schema/weapon';

import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import type { LibraryFile, Located } from './readItems';
import { readItems } from './readItems';
import { findDuplicateIds } from './uniqueIds';

/** Everything the engine reads, by id. */
export type Library = {
  readonly weapons: ReadonlyMap<string, Weapon>;
  readonly modules: ReadonlyMap<string, Module>;
  readonly enemies: ReadonlyMap<string, Enemy>;
};

export type LoadResult =
  | { readonly ok: true; readonly library: Library }
  | { readonly ok: false; readonly errors: readonly LibraryError[] };

const WEAPON_FOLDERS = ['weapons'];
const MODULE_FOLDERS = ['mods', 'arcanes', 'buffs'];
const ENEMY_FOLDERS = ['enemies'];
const FOLDERS = [...WEAPON_FOLDERS, ...MODULE_FOLDERS, ...ENEMY_FOLDERS];

const folderOf = ({ path }: LibraryFile) => path.split('/')[0] ?? '';

const filesIn = (files: readonly LibraryFile[], folders: readonly string[]) =>
  files.filter((file) => folders.includes(folderOf(file)));

const findStrays = (files: readonly LibraryFile[]) =>
  files
    .filter((file) => !FOLDERS.includes(folderOf(file)))
    .map(({ path }) =>
      errorAt(path, [], `No schema for this file. Folders: ${FOLDERS.join(', ')}`),
    );

const byId = <Item extends { readonly id: string }>(located: readonly Located<Item>[]) =>
  new Map(located.map(({ item }) => [item.id, item]));

/**
 * Validates library files and indexes their items by id. It collects every error, and returns a
 * library only when there are none. Reading the files is up to the caller.
 */
export const loadLibrary = (files: readonly LibraryFile[]): LoadResult => {
  const weapons = readItems(weaponSchema, filesIn(files, WEAPON_FOLDERS));
  const modules = readItems(moduleSchema, filesIn(files, MODULE_FOLDERS));
  const enemies = readItems(enemySchema, filesIn(files, ENEMY_FOLDERS));

  const errors = [
    ...findStrays(files),
    ...[weapons, modules, enemies].flatMap((read) => [
      ...read.errors,
      ...findDuplicateIds(read.items),
    ]),
  ];
  if (errors.length > 0) return { ok: false, errors };

  const library = {
    weapons: byId(weapons.items),
    modules: byId(modules.items),
    enemies: byId(enemies.items),
  };
  return { ok: true, library };
};
