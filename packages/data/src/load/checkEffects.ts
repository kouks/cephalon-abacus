import type { Effect } from '@/schema/effect';
import type { Module } from '@/schema/module';
import type { Weapon } from '@/schema/weapon';

import { findBucket } from './findBucket';
import type { Reference } from './library';
import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import type { Located } from './readItems';

type Path = readonly PropertyKey[];
type Placed = { readonly effect: Effect; readonly path: Path };

const place = (effects: readonly Effect[], path: Path): readonly Placed[] =>
  effects.map((effect, index) => ({ effect, path: [...path, index] }));

const inModule = ({ effects }: Module, path: Path = []) => place(effects, [...path, 'effects']);

const inWeapon = ({ innatePassives = [], zoomLevels = [], incarnon }: Weapon) => [
  ...place(innatePassives, ['innatePassives']),
  ...zoomLevels.flatMap(({ effects }, index) => place(effects, ['zoomLevels', index, 'effects'])),
  ...(incarnon?.evolutions ?? []).flatMap(({ choices }, tier) =>
    choices.flatMap((choice, index) =>
      inModule(choice, ['incarnon', 'evolutions', tier, 'choices', index]),
    ),
  ),
];

/** Every effect of these items writes into a bucket that exists. */
const check = <Item>(
  located: readonly Located<Item>[],
  effectsOf: (item: Item) => readonly Placed[],
  reference: Reference,
): readonly LibraryError[] =>
  located.flatMap(({ item, file, index }) =>
    effectsOf(item)
      .filter(({ effect }) => findBucket(effect.bucket, reference) === undefined)
      .map(({ effect, path }) =>
        errorAt(
          file,
          ['items', index, ...path, 'bucket'],
          `"${effect.bucket}" is not a bucket (buckets.json)`,
        ),
      ),
  );

export const checkModuleEffects = (modules: readonly Located<Module>[], reference: Reference) =>
  check(modules, inModule, reference);

export const checkWeaponEffects = (weapons: readonly Located<Weapon>[], reference: Reference) =>
  check(weapons, inWeapon, reference);
