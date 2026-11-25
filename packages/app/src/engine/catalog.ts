import type { Library } from '@abacus/data/load/library';
import type { Module } from '@abacus/data/schema/module';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Catalog } from './protocol';

/** Any of them will do, if any are asked for. */
const hasAny = <T>(asked: readonly T[] | undefined, has: readonly T[]) =>
  asked === undefined || asked.some((entry) => has.includes(entry));

const fits = ({ compat }: Module, { slot, class: classes, compatTags = [] }: Weapon) =>
  compat.slots.includes(slot) && hasAny(compat.classes, classes) && hasAny(compat.tags, compatTags);

const named = ({ id, name }: Module | Weapon) => ({ id, name });

/** Every weapon of the library, with the modules that fit it. */
export const catalogOf = ({ weapons, modules }: Library): Catalog => ({
  weapons: [...weapons.values()].map((weapon) => ({
    ...named(weapon),
    modules: [...modules.values()].filter((module) => fits(module, weapon)).map(named),
  })),
});
