import { describe, expect, it } from 'vitest';

import { quantile } from './quantile.ts';

const SAMPLE = [5, 1, 4, 2, 3, 10, 9, 8, 7, 6];

describe('a quantile', () => {
  it.each([
    [0, 1],
    [0.5, 5],
    [0.95, 10],
    [1, 10],
  ])('of %d is %d', (share, expected) => {
    expect(quantile(SAMPLE, share)).toBe(expected);
  });

  it('needs a sample', () => {
    expect(() => quantile([], 0.5)).toThrow('empty sample');
  });
});
