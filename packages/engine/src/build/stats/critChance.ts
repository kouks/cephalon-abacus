import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { BucketTotal } from '@/build/aggregate';
import { aggregate, joinTotals } from '@/build/aggregate';
import type { BucketTotals } from '@/build/totalBuckets';

import type { ModdedStat } from './moddedStat';
import { totalIn } from './moddedStat';

export const canCrit = ({ flags }: Attack): boolean => flags?.includes('canCrit') === true;

/** Weak point crit chance, with the bonuses to all hits or multiplying them. */
const withWeakPoint = (relative: BucketTotal, weakPoint: BucketTotal, { critStacking }: Weapon) =>
  critStacking === 'multiplicative'
    ? (base: number) => aggregate(weakPoint, aggregate(relative, base))
    : (base: number) => aggregate(joinTotals(relative, weakPoint), base);

/** A set crit chance ignores every other bonus (Crystallize). */
const setChance = (totals: readonly BucketTotal[]) => {
  const set = totals.flatMap(({ override }) => override ?? []);
  return set.length === 0 ? undefined : Math.max(...set);
};

/** base × (1 + relative + per combo tier + on weak points) + flat (BIBLE §7). */
export const modCritChance = (weapon: Weapon, attack: Attack, all: BucketTotals): ModdedStat => {
  const base = attack.critChance;
  if (!canCrit(attack)) return { base, value: 0, totals: [] };
  const relative = totalIn(all, 'crit.chance');
  const combo = totalIn(all, 'crit.chanceCombo');
  const weakPoint = totalIn(all, 'crit.chanceWeakPoint');
  const flat = totalIn(all, 'crit.chanceFlat');

  const totals = [relative, combo, weakPoint, flat];
  const modded = withWeakPoint(joinTotals(relative, combo), weakPoint, weapon)(base);
  const value = setChance(totals) ?? Math.max(aggregate(flat, modded), 0);
  return { base, value, totals };
};
