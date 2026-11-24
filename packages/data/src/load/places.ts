import type { LibraryFile } from './readItems';

export const DAMAGE_TYPES_FILE = 'damageTypes.json';
export const BUCKETS_FILE = 'buckets.json';
export const FACTIONS_FILE = 'factions.json';

export const REFERENCE_FILES = [DAMAGE_TYPES_FILE, BUCKETS_FILE, FACTIONS_FILE];

export const WEAPON_FOLDERS = ['weapons'];
export const MODULE_FOLDERS = ['mods', 'arcanes', 'buffs'];
export const ENEMY_FOLDERS = ['enemies'];

const PLACES = [...REFERENCE_FILES, ...WEAPON_FOLDERS, ...MODULE_FOLDERS, ...ENEMY_FOLDERS];

/** A file's folder, or its name when it is at the top. */
const placeOf = ({ path }: LibraryFile) => path.split('/')[0] ?? '';

export const filesAt = (files: readonly LibraryFile[], places: readonly string[]) =>
  files.filter((file) => places.includes(placeOf(file)));

/** Files the loader has no schema for. */
export const straysIn = (files: readonly LibraryFile[]) =>
  files.filter((file) => !PLACES.includes(placeOf(file)));

export const missingFrom = (files: readonly LibraryFile[]) =>
  REFERENCE_FILES.filter((name) => !files.some(({ path }) => path === name));

export const describePlaces = () => PLACES.join(', ');
