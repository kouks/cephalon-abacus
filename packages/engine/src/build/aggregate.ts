import type { Bucket } from '@abacus/data/schema/bucket';
import type { Op } from '@abacus/data/schema/effect';

import type { Contribution } from './types';

/** A bucket's effects summed up, and the effects themselves. */
export type BucketTotal = {
  readonly bucket: string;
  /** Σ STACKING_MULTIPLY */
  readonly stacking: number;
  /** Π (1 + MULTIPLY) */
  readonly multiply: number;
  /** Σ ADD */
  readonly add: number;
  /** The highest OVERRIDE, so that the order of the modules doesn't matter. */
  readonly override?: number;
  /** The highest value the game allows. */
  readonly max?: number;
  readonly contributions: readonly Contribution[];
};

/** Sums the contributions to one bucket by op (BIBLE §5). */
export const totalOf = (
  bucket: string,
  contributions: readonly Contribution[],
  { max }: Pick<Bucket, 'max'>,
): BucketTotal => {
  const values = (op: Op) =>
    contributions.filter((entry) => entry.op === op).map(({ value }) => value);
  const overrides = values('OVERRIDE');
  return {
    bucket,
    stacking: values('STACKING_MULTIPLY').reduce((sum, value) => sum + value, 0),
    multiply: values('MULTIPLY').reduce((product, value) => product * (1 + value), 1),
    add: values('ADD').reduce((sum, value) => sum + value, 0),
    ...(overrides.length === 0 ? {} : { override: Math.max(...overrides) }),
    ...(max === undefined ? {} : { max }),
    contributions,
  };
};

/** Buckets whose bonuses add up with each other, as one. */
export const joinTotals = (first: BucketTotal, ...others: readonly BucketTotal[]): BucketTotal =>
  totalOf(
    first.bucket,
    [first, ...others].flatMap(({ contributions }) => contributions),
    first,
  );

/** base × (1 + Σ STACKING_MULTIPLY) × Π (1 + MULTIPLY) + Σ ADD, or the override (BIBLE §5). */
export const aggregate = (total: BucketTotal, base: number): number => {
  const { stacking, multiply, add, override, max = Number.POSITIVE_INFINITY } = total;
  return Math.min(override ?? base * (1 + stacking) * multiply + add, max);
};
