import type { Attack } from '@abacus/data/schema/attack';

import { aggregate } from '@/build/aggregate';
import { totalIn } from '@/build/stats/moddedStat';
import type { BucketTotals } from '@/build/totalBuckets';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

type Falloff = NonNullable<Attack['falloff']>;

/** All damage up to the start, the least from the end on, and a straight line between them. */
const shareAt = (distance: number, { start, end, minPct }: Falloff) => {
  if (distance <= start) return 1;
  if (distance >= end) return minPct;
  return 1 - (1 - minPct) * ((distance - start) / (end - start));
};

/** What is left of the damage at a distance. Projectile speed stretches it (BIBLE §11). */
export const falloffFactor = (
  { falloff }: Attack,
  totals: BucketTotals,
  distance: number,
): Factor => {
  if (falloff === undefined) return factor('falloff', 1);
  const speed = totalIn(totals, 'projectileSpeed');
  const stretch = aggregate(speed, 1);
  const { start, end, minPct } = falloff;
  const stretched = { start: start * stretch, end: end * stretch, minPct };
  return factor('falloff', shareAt(distance, stretched), effectsOf([speed]));
};
