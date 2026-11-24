import type { Library } from '@abacus/data/load/library';
import type { Module } from '@abacus/data/schema/module';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Catalog } from './protocol';

const fits = ({ compat }: Module, { slot, class: classes }: Weapon) =>
  compat.slots.includes(slot) &&
  (compat.classes === undefined || compat.classes.some((entry) => classes.includes(entry)));

const named = ({ id, name }: Module | Weapon) => ({ id, name });

/** Every weapon of the library, with the modules that fit it. */
export const catalogOf = ({ weapons, modules }: Library): Catalog => ({
  weapons: [...weapons.values()].map((weapon) => ({
    ...named(weapon),
    modules: [...modules.values()].filter((module) => fits(module, weapon)).map(named),
  })),
});
