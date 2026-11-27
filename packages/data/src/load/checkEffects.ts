import type { Effect } from '@/schema/effect';
import type { Module } from '@/schema/module';
import type { Status } from '@/schema/status';
import type { Weapon } from '@/schema/weapon';

import { findBucket } from './findBucket';
import type { Reference } from './library';
import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import type { Located } from './readItems';

type Path = readonly PropertyKey[];
/** A bucket an item names, and where. */
type Named = { readonly name: string; readonly path: Path };

const place = (effects: readonly Pick<Effect, 'bucket'>[], path: Path): readonly Named[] =>
  effects.map(({ bucket }, index) => ({ name: bucket, path: [...path, index, 'bucket'] }));

const inModule = ({ effects, locks = [] }: Module, path: Path = []): readonly Named[] => [
  ...place(effects, [...path, 'effects']),
  ...locks.map((name, index) => ({ name, path: [...path, 'locks', index] })),
];

const inWeapon = ({ innatePassives = [], zoomLevels = [], incarnon }: Weapon) => [
  ...place(innatePassives, ['innatePassives']),
  ...zoomLevels.flatMap(({ effects }, index) => place(effects, ['zoomLevels', index, 'effects'])),
  ...(incarnon?.evolutions ?? []).flatMap(({ choices }, tier) =>
    choices.flatMap((choice, index) =>
      inModule(choice, ['incarnon', 'evolutions', tier, 'choices', index]),
    ),
  ),
];

/** Every bucket these items name exists. */
const check = <Item>(
  located: readonly Located<Item>[],
  bucketsOf: (item: Item) => readonly Named[],
  reference: Reference,
): readonly LibraryError[] =>
  located.flatMap(({ item, file, index }) =>
    bucketsOf(item)
      .filter(({ name }) => findBucket(name, reference) === undefined)
      .map(({ name, path }) =>
        errorAt(file, ['items', index, ...path], `"${name}" is not a bucket (buckets.json)`),
      ),
  );

export const checkModuleEffects = (modules: readonly Located<Module>[], reference: Reference) =>
  check(modules, inModule, reference);

export const checkWeaponEffects = (weapons: readonly Located<Weapon>[], reference: Reference) =>
  check(weapons, inWeapon, reference);

const inStatus = ({ effects = [] }: Status) => place(effects, ['effects']);

/** What a status does names buckets that exist, as a module's effects do. */
export const checkStatusEffects = (statuses: readonly Located<Status>[], reference: Reference) =>
  check(statuses, inStatus, reference);
