import type { Attack } from '@abacus/data/schema/attack';

import type { Assumptions } from '@/assumptions';
import { aggregate } from '@/build/aggregate';
import type { BuiltAttack } from '@/build/buildAttack';
import { totalIn } from '@/build/stats/moddedStat';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

type Falloff = NonNullable<Attack['falloff']>;

/**
 * All damage up to the start, and the least from the end on. Between them it drops in a straight
 * line that heads for nothing at the end, so it meets the least on the way (T-25).
 */
const shareAt = (
  distance: number,
  { start, end, minPct }: Falloff,
  { falloffHeadsForZero }: Assumptions,
) => {
  if (distance <= start) return 1;
  if (distance >= end) return minPct;
  const way = (distance - start) / (end - start);
  return falloffHeadsForZero ? Math.max(1 - way, minPct) : 1 - (1 - minPct) * way;
};

/** What is left of the damage at a distance. Projectile speed stretches it (BIBLE §11). */
export const falloffFactor = (
  { attack: { falloff }, totals, assumptions }: BuiltAttack,
  distance: number,
): Factor => {
  if (falloff === undefined) return factor('falloff', 1);
  const speed = totalIn(totals, 'projectileSpeed');
  const stretch = aggregate(speed, 1);
  const { start, end, minPct } = falloff;
  const stretched = { start: start * stretch, end: end * stretch, minPct };
  return factor('falloff', shareAt(distance, stretched, assumptions), effectsOf([speed]));
};
