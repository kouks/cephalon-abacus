import { aggregate } from '@/build/aggregate';
import { totalIn } from '@/build/stats/moddedStat';
import type { BucketTotals } from '@/build/totalBuckets';
import type { TargetPart } from '@/resolve/target';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

/** How much weak point bonuses count on a head. Elsewhere: once. */
const HEAD_RATE = 1.5;

/** W: (multiplier + rate × weak point damage) × (1 + headshot damage) (BIBLE §11). */
export const bodyPartFactor = (
  totals: BucketTotals,
  { multiplier, bodyParts }: TargetPart,
): Factor => {
  const weakPoint = totalIn(totals, 'weakPoint.damage');
  const headshot = totalIn(totals, 'headshot.damage');
  const rate = bodyParts.includes('head') ? HEAD_RATE : 1;
  const value = (multiplier + rate * aggregate(weakPoint, 0)) * aggregate(headshot, 1);
  return factor('bodyPart', value, effectsOf([weakPoint, headshot]));
};
