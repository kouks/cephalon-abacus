import type { BucketTotal } from '@/build/aggregate';
import type { Contribution } from '@/build/types';
import type { Factor, FactorName } from '@/trace/hitTrace';

export const effectsOf = (totals: readonly BucketTotal[]): readonly Contribution[] =>
  totals.flatMap(({ contributions }) => contributions);

/** A factor for every damage type. It never turns damage negative. */
export const factor = (
  name: FactorName,
  value: number,
  effects: readonly Contribution[] = [],
): Factor => ({ name, value: Math.max(value, 0), effects });
