import type { Attack } from '@abacus/data/schema/attack';
import type { DamageType } from '@abacus/data/schema/damageType';
import { DAMAGE_TYPES } from '@abacus/data/schema/damageType';
import type { Progenitor } from '@abacus/data/schema/progenitor';
import type { Scenario } from '@abacus/data/schema/scenario';
import type { Weapon } from '@abacus/data/schema/weapon';

/** One type of base damage: the attack's own, or its progenitor's. */
export type BasePart = {
  readonly type: DamageType;
  readonly amount: number;
  readonly origin: 'innate' | 'progenitor';
};

export type BaseDamage = { readonly total: number; readonly parts: readonly BasePart[] };

/** The weapon's progenitor bonus, as the build sets it. */
export const progenitorOf = (
  { progenitor }: Weapon,
  build: Scenario['build'],
): Progenitor | undefined =>
  progenitor === undefined ? undefined : (build.progenitor ?? progenitor);

const sum = (parts: readonly BasePart[]) => parts.reduce((total, { amount }) => total + amount, 0);

const ownParts = ({ damage }: Attack) =>
  DAMAGE_TYPES.flatMap((type): readonly BasePart[] => {
    const amount = damage[type];
    return amount === undefined ? [] : [{ type, amount, origin: 'innate' }];
  });

/** Base damage per type. A progenitor adds a share of the attack's own, of its element. */
export const baseDamage = (attack: Attack, progenitor: Progenitor | undefined): BaseDamage => {
  const own = ownParts(attack);
  if (progenitor === undefined) return { total: sum(own), parts: own };
  const amount = progenitor.pct * sum(own);
  const parts = [...own, { type: progenitor.element, amount, origin: 'progenitor' } as const];
  return { total: sum(parts), parts };
};
