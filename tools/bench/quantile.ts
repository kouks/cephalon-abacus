import { must } from '#data/assert.ts';

/** The value that a share of the sample stays at or below. */
export const quantile = (sample: readonly number[], share: number): number => {
  const sorted = [...sample].sort((a, b) => a - b);
  const index = Math.max(Math.ceil(sorted.length * share) - 1, 0);
  return must(sorted[index], 'An empty sample has no quantiles');
};
