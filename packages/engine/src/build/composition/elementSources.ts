import type { Library } from '@abacus/data/load/library';
import type { DamageType } from '@abacus/data/schema/damageType';
import { DAMAGE_TYPES } from '@abacus/data/schema/damageType';
import type { Scenario } from '@abacus/data/schema/scenario';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { ElementSource } from '@/build/elements/types';
import type { Contribution } from '@/build/types';

import type { BaseDamage } from './baseDamage';

const memberOf = (family: string, bucket: string): DamageType | undefined =>
  DAMAGE_TYPES.find((type) => bucket === `${family}.${type}`);

/** The element a bucket adds, if it can combine. */
export const combiningElement = (bucket: string): DamageType | undefined =>
  memberOf('damage.element', bucket);

type Context = {
  readonly build: Scenario['build'];
  readonly library: Library;
  readonly contributions: readonly Contribution[];
};

/** The build's modules by slot: as `elementOrder` says, then as it lists them. */
const slotsOf = ({ elementOrder, modules }: Scenario['build']): readonly string[] => [
  ...new Set([...elementOrder, ...modules.map(({ moduleId }) => moduleId)]),
];

/** Elemental bonuses in the build's order. What is not in a slot comes after what is. */
const bonusSources = (weapon: Weapon, { build, library, contributions }: Context) => {
  const slots = slotsOf(build);
  const placeOf = (sourceId: string) => {
    if (sourceId === weapon.id) return { origin: 'innate' } as const;
    const slot = slots.indexOf(sourceId);
    const origin = library.modules.get(sourceId)?.kind === 'riven' ? 'riven' : 'mod';
    return { origin, slotIndex: slot === -1 ? slots.length : slot } as const;
  };
  return contributions.flatMap((contribution): readonly ElementSource[] => {
    const { bucket, source, value } = contribution;
    const entry = { ratio: value, name: source.name, contribution };
    const element = combiningElement(bucket);
    if (element !== undefined) return [{ ...placeOf(source.id), ...entry, element }];
    const apart = memberOf('damage.elementNoCombine', bucket);
    return apart === undefined ? [] : [{ origin: 'ability', ...entry, element: apart }];
  });
};

/** Everything that makes an attack elemental, as shares of its total base damage. */
export const elementSources = (
  weapon: Weapon,
  base: BaseDamage,
  context: Context,
): readonly ElementSource[] => {
  const { damageTypes } = context.library;
  const own = base.parts
    .filter(({ type }) => damageTypes.get(type)?.group !== 'physical')
    .map(({ type, amount, origin }) => {
      const ratio = amount / base.total;
      return { origin, element: type, ratio, name: weapon.name };
    });
  return [...bonusSources(weapon, context), ...own];
};
