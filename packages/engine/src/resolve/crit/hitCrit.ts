import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Assumptions } from '@/assumptions';
import { modCritChance } from '@/build/stats/critChance';
import type { CritMultiplier } from '@/build/stats/critMultiplier';
import { modCritMultiplier } from '@/build/stats/critMultiplier';
import type { ModdedStat } from '@/build/stats/moddedStat';
import type { BucketTotals } from '@/build/totalBuckets';

import type { TierChance, TierRaise } from './critTiers';
import { critTiers, expectedCrit } from './critTiers';

/** Where a hit lands, as far as crits go. The totals already know if it is a weak point. */
export type CritLocation = {
  /** What the part multiplies the crit multiplier by: 2 on most heads. Absent: 1. */
  readonly headcrit?: number;
  readonly raises?: readonly TierRaise[];
};

/** A hit's crit, with the terms behind its chance and multiplier. */
export type HitCrit = {
  readonly chance: ModdedStat;
  readonly multiplier: CritMultiplier;
  readonly tiers: readonly TierChance[];
  /** What crits multiply damage by on average. */
  readonly expected: number;
};

type Context = CritLocation & {
  /** Every bucket's total for this hit: its scope and body part. */
  readonly totals: BucketTotals;
  readonly assumptions: Assumptions;
};

export const hitCrit = (weapon: Weapon, attack: Attack, context: Context): HitCrit => {
  const chance = modCritChance(weapon, attack, context.totals);
  const multiplier = modCritMultiplier(attack, context);
  const tiers = critTiers(chance.value, context.raises);
  return { chance, multiplier, tiers, expected: expectedCrit(tiers, multiplier.value) };
};
