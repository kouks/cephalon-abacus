import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { quantize } from './quantize';

const ratio = fc.double({ min: 0, max: 20, noNaN: true });

describe('quantize', () => {
  it.each([
    [0.3, 10 / 32],
    [0.4, 13 / 32],
    [1.8, 58 / 32],
    [1, 1],
    [0, 0],
    [1 / 64, 1 / 32],
    [0.99 / 64, 0],
  ])('%d is %d', (value, expected) => {
    expect(quantize(value)).toBeCloseTo(expected, 12);
  });

  it('gives whole 32nds, and moves by at most half of one', () => {
    fc.assert(
      fc.property(ratio, (value) => {
        expect(Number.isInteger(quantize(value) * 32)).toBe(true);
        expect(Math.abs(quantize(value) - value)).toBeLessThanOrEqual(1 / 64);
      }),
    );
  });

  it('never orders two ratios the other way around', () => {
    fc.assert(
      fc.property(ratio, ratio, (...[one, other]) => {
        const [low, high] = one < other ? [one, other] : [other, one];
        expect(quantize(low)).toBeLessThanOrEqual(quantize(high));
      }),
    );
  });
});
