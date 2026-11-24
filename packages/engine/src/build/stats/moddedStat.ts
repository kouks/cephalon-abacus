import { invariant } from '@abacus/data/assert';

import type { BucketTotal } from '@/build/aggregate';
import { aggregate } from '@/build/aggregate';
import type { BucketTotals } from '@/build/totalBuckets';

/** A stat before and after mods, and the bucket totals that changed it. */
export type ModdedStat = {
  readonly base: number;
  readonly value: number;
  readonly totals: readonly BucketTotal[];
};

export const totalIn = (totals: BucketTotals, bucket: string): BucketTotal => {
  const total = totals.get(bucket);
  invariant(total !== undefined, `buckets.json has no "${bucket}"`);
  return total;
};

/** A stat run through its bucket, then through each of the others: flat bonuses come last. */
export const modStat = (
  totals: BucketTotals,
  base: number,
  buckets: readonly string[],
): ModdedStat => {
  const used = buckets.map((bucket) => totalIn(totals, bucket));
  return {
    base,
    value: used.reduce((value, total) => aggregate(total, value), base),
    totals: used,
  };
};

/** A time: its base over the speed. Nothing finishes at a speed of zero or less. */
export const modTime = (base: number, speed: BucketTotal, minSpeed = 0): ModdedStat => {
  const factor = Math.max(aggregate(speed, 1), minSpeed);
  return { base, value: base / factor, totals: [speed] };
};
