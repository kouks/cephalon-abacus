import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Assumptions } from '@/assumptions';
import type { BucketTotal } from '@/build/aggregate';
import { aggregate } from '@/build/aggregate';
import type { BucketTotals } from '@/build/totalBuckets';

import type { ModdedStat } from './moddedStat';
import { modTime, totalIn } from './moddedStat';

/** Semi-automatic weapons can't be fired faster before bonuses (BIBLE §9). */
const SEMI_AUTO_CAP = 10;

/** A charge takes at most ten times its base, whatever slows it (BIBLE §9). */
const MIN_CHARGE_SPEED = 0.1;

/** The fire rate bucket as this weapon feels it: bows count its bonuses twice. */
export const fireRateTotal = (
  totals: BucketTotals,
  weapon: Weapon,
  { bowFireRateDoubled }: Assumptions,
): BucketTotal => {
  const total = totalIn(totals, 'fireRate');
  const scale = bowFireRateDoubled ? (weapon.fireRateBonusScale ?? 1) : 1;
  return { ...total, stacking: total.stacking * scale };
};

export const modFireRate = ({ trigger, fireRate }: Attack, total: BucketTotal): ModdedStat => {
  const base = trigger === 'semi' ? Math.min(fireRate, SEMI_AUTO_CAP) : fireRate;
  return { base, value: Math.max(aggregate(total, base), 0), totals: [total] };
};

export const modChargeTime = (chargeTime: number, total: BucketTotal): ModdedStat =>
  modTime(chargeTime, total, MIN_CHARGE_SPEED);

/** The time between the shots of a burst. Slowing the weapon down doesn't stretch it. */
export const modBurstDelay = (burstDelay: number, total: BucketTotal): ModdedStat =>
  modTime(burstDelay, total, 1);
