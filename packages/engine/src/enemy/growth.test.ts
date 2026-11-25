import { describe, expect, it } from 'vitest';

import type { ScalingCurve } from '@abacus/data/schema/scaling';
import { scalingRuleSchema } from '@abacus/data/schema/scaling';
import { curve } from '@abacus/data/testing/scaling';

import { growthAt } from './growth';

const curveOf = (change: object = {}): ScalingCurve => {
  const rule = scalingRuleSchema.parse({ ...curve, ...change });
  if (rule.kind !== 'curve') throw new Error('Not a curve');
  return rule;
};

const at = (level: number, change: object = {}, baseLevel = 1) =>
  growthAt(curveOf(change), { level, baseLevel });

describe('an enemy stat', () => {
  it('is the base stat at the base level, and below it', () => {
    expect([at(1), at(20, {}, 20), at(5, {}, 20)].map(({ multiplier }) => multiplier)).toEqual([
      1, 1, 1,
    ]);
    expect(at(5, {}, 20).levels).toBe(0);
  });

  it('follows the low curve up to the blend, and the high one from its end', () => {
    expect(at(11).multiplier).toBeCloseTo(2, 6);
    expect(at(71).multiplier).toBeCloseTo(50, 5);
    expect(at(81).multiplier).toBeCloseTo(1 + 10 * Math.sqrt(80), 4);
    expect(at(101).multiplier).toBeCloseTo(101, 5);
  });

  it('is in between in the blend: halfway in the middle, and slow at the ends', () => {
    const { low, high, blend, multiplier } = at(76);
    expect([low, high]).toEqual([expect.closeTo(57.25, 4), expect.closeTo(87.6025, 4)]);
    expect(blend).toBe(0.5);
    expect(multiplier).toBeCloseTo((57.25 + 87.6025) / 2, 3);
    expect([at(72).blend, at(80).blend].map((value) => Number(value.toFixed(6)))).toEqual([
      0.028, 0.972,
    ]);
  });

  it('counts levels above the base level, or above 1 for everyone', () => {
    expect(at(60, {}, 20).levels).toBe(40);
    expect(at(60, { above: 'one' }, 20).levels).toBe(59);
  });

  it('is worked out in 32 bits', () => {
    const { multiplier, low } = at(34, { low: { coefficient: 0.015, exponent: 2.12 } });
    expect(Math.fround(multiplier)).toBe(multiplier);
    expect(low).not.toBe(1 + 0.015 * 33 ** 2.12);
    expect(low).toBeCloseTo(1 + 0.015 * 33 ** 2.12, 4);
  });
});
