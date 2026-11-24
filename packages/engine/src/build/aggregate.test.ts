import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Op } from '@abacus/data/schema/effect';

import { aggregate, totalOf } from './aggregate';
import type { Contribution } from './types';

const source = { id: 'mod', name: 'Mod' };

const contributions = (...entries: readonly (readonly [Op, number])[]): readonly Contribution[] =>
  entries.map(([op, value]) => ({ source, bucket: 'damage.base', op, value }));

const total = (...entries: readonly (readonly [Op, number])[]) =>
  totalOf('damage.base', contributions(...entries), {});

const SM = 'STACKING_MULTIPLY';

describe('aggregate', () => {
  it('returns the base without effects', () => {
    expect(aggregate(total(), 100)).toBe(100);
  });

  it('adds up STACKING_MULTIPLY: Serration and Heavy Caliber', () => {
    expect(aggregate(total([SM, 1.65], [SM, 1.65]), 100)).toBeCloseTo(430, 10);
  });

  it('multiplies each MULTIPLY: two resistances, x0.55 and x0.85', () => {
    expect(aggregate(total(['MULTIPLY', -0.45], ['MULTIPLY', -0.15]), 100)).toBeCloseTo(46.75, 10);
  });

  it('adds ADD after the percentages: Entropy Burst', () => {
    expect(aggregate(total([SM, 0.9], ['ADD', 0.2]), 0.3)).toBeCloseTo(0.77, 10);
  });

  it('applies all three in order', () => {
    const mixed = total(['ADD', 5], ['MULTIPLY', 0.5], [SM, 1], ['MULTIPLY', 1], [SM, 0.5]);
    expect(aggregate(mixed, 10)).toBeCloseTo(10 * 2.5 * 3 + 5, 10);
  });

  it('replaces the result with an OVERRIDE: Crystallize sets 300%', () => {
    expect(aggregate(total([SM, 5], ['ADD', 1], ['OVERRIDE', 3]), 0.2)).toBe(3);
  });

  it('takes the highest OVERRIDE, in either order', () => {
    expect(aggregate(total(['OVERRIDE', 3], ['OVERRIDE', 1]), 0.2)).toBe(3);
    expect(aggregate(total(['OVERRIDE', 1], ['OVERRIDE', 3]), 0.2)).toBe(3);
  });

  it('can be overridden to zero', () => {
    expect(aggregate(total([SM, 1], ['OVERRIDE', 0]), 10)).toBe(0);
  });

  it('stops at the max of the bucket', () => {
    const capped = totalOf('ammoEfficiency', contributions(['ADD', 0.5], ['ADD', 0.5]), {
      max: 0.75,
    });
    expect(aggregate(capped, 0)).toBe(0.75);
    const below = totalOf('ammoEfficiency', contributions(['ADD', 0.5]), { max: 0.75 });
    expect(aggregate(below, 0)).toBe(0.5);
  });

  it('keeps the contributions, as they came', () => {
    const entries = contributions([SM, 1.65], ['ADD', 1]);
    expect(totalOf('damage.base', entries, {}).contributions).toBe(entries);
  });
});

describe('properties', () => {
  const op = fc.constantFrom<Op>(SM, 'MULTIPLY', 'ADD', 'OVERRIDE');
  const amount = fc.double({ min: 0, max: 10, noNaN: true });
  const entry = fc.tuple(op, amount);
  const base = fc.double({ min: 0, max: 1000, noNaN: true });

  const isClose = (a: number, b: number) =>
    Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

  it('the order of the effects does not matter', () => {
    const shuffled = fc
      .array(entry, { maxLength: 8 })
      .chain((entries) =>
        fc.tuple(fc.constant(entries), fc.shuffledSubarray(entries, { minLength: entries.length })),
      );
    fc.assert(
      fc.property(shuffled, base, ([entries, other], value) => {
        expect(
          isClose(aggregate(total(...entries), value), aggregate(total(...other), value)),
        ).toBe(true);
      }),
    );
  });

  it('another positive effect never lowers the result, without overrides', () => {
    const positive = fc.tuple(fc.constantFrom<Op>(SM, 'MULTIPLY', 'ADD'), amount);
    fc.assert(
      fc.property(fc.array(positive, { maxLength: 8 }), positive, base, (entries, extra, value) => {
        const before = aggregate(total(...entries), value);
        expect(aggregate(total(...entries, extra), value)).toBeGreaterThanOrEqual(
          before * (1 - 1e-12),
        );
      }),
    );
  });
});
