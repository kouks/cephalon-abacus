import { aggregate } from '@/build/aggregate';
import type { BucketTotals } from '@/build/totalBuckets';
import type { Factor } from '@/trace/hitTrace';

import { factor } from './factor';

/** What the enemy takes less of, from enemy and mission modules: Eximus auras, mission binds. */
export const DAMAGE_TAKEN = 'enemy.damage';

/**
 * Π (1 + MULTIPLY) of what the enemy takes (BIBLE §10). It comes after the least of 1 that armor
 * leaves each type, so it has no least of its own.
 */
export const reductionFactor = (totals: BucketTotals): Factor => {
  const total = totals.get(DAMAGE_TAKEN);
  if (total === undefined) return factor('reduction', 1);
  return factor('reduction', aggregate(total, 1), total.contributions);
};
