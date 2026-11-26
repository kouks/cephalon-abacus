import type { DamageType } from '@abacus/data/schema/damageType';

import type { Factor } from '@/trace/hitTrace';

import type { TierChance } from './crit/critTiers';
import { tierMultiplier } from './crit/critTiers';
import { factor } from './factors/factor';

/** A type's damage before crits, and whether armor reduced it. */
export type TypeDamage = {
  readonly type: DamageType;
  readonly white: number;
  readonly isArmored: boolean;
};

/** Each type that armor reduces deals at least 1 (the wiki's Armor page). Nothing else has a least. */
const atLeastOne = (damage: number, isArmored: boolean) =>
  isArmored && damage > 0 && damage < 1 ? 1 : damage;

type Crit = { readonly tiers: readonly TierChance[]; readonly multiplier: number };

/** The number a crit tier shows: every type at that tier, each at least 1 under armor. */
export const tierTotal = (types: readonly TypeDamage[], tier: number, multiplier: number) =>
  types.reduce(
    (sum, { white, isArmored }) =>
      sum + atLeastOne(white * tierMultiplier(tier, multiplier), isArmored),
    0,
  );

const expectedOf = ({ white, isArmored }: TypeDamage, { tiers, multiplier }: Crit) =>
  tiers.reduce(
    (sum, { tier, chance }) =>
      sum + chance * atLeastOne(white * tierMultiplier(tier, multiplier), isArmored),
    0,
  );

/** What the least of 1 adds to each type on average, as a factor: 1 where it adds nothing. */
export const leastFactors = (types: readonly TypeDamage[], crit: Crit): readonly Factor[] => {
  const mean = crit.tiers.reduce(
    (sum, { tier, chance }) => sum + chance * tierMultiplier(tier, crit.multiplier),
    0,
  );
  return types.map((entry) => {
    const plain = entry.white * mean;
    return {
      ...factor('least', plain > 0 ? expectedOf(entry, crit) / plain : 1),
      type: entry.type,
    };
  });
};
