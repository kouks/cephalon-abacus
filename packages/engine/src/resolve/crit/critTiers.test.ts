import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { TierChance, TierRaise } from './critTiers';
import { critTiers, expectedCrit, tierMultiplier } from './critTiers';

const VIGILANTE: TierRaise = { chance: 0.3, from: 1 };
const PROMOTION: TierRaise = { chance: 1, from: 0 };

const critChance = fc.double({ min: 0, max: 12, noNaN: true });
const multiplier = fc.double({ min: 1, max: 30, noNaN: true });
const raise = fc.record({
  chance: fc.double({ min: 0, max: 1, noNaN: true }),
  from: fc.integer({ min: 0, max: 3 }),
});

const sumOf = (tiers: readonly TierChance[]) => tiers.reduce((sum, { chance }) => sum + chance, 0);

/** "1: 75%, 2: 25%" */
const describeTiers = (...args: Parameters<typeof critTiers>) =>
  critTiers(...args)
    .map(({ tier, chance }) => `${tier}: ${Number((chance * 100).toFixed(6))}%`)
    .join(', ');

describe('crit tiers', () => {
  it.each([
    [0, '0: 100%'],
    [0.2, '0: 80%, 1: 20%'],
    [1, '1: 100%'],
    [2.5, '2: 50%, 3: 50%'],
    [3, '3: 100%'],
    [6.75, '6: 25%, 7: 75%'],
  ])('at %d crit chance are %s', (chance, expected) => {
    expect(describeTiers(chance)).toBe(expected);
  });

  it('lenz with Point Strike has 25% orange crits and 75% yellow', () => {
    expect(describeTiers(0.5 * 2.5)).toBe('1: 75%, 2: 25%');
  });

  it('are raised by a part that promotes every hit', () => {
    expect(describeTiers(0.2, [PROMOTION])).toBe('1: 80%, 2: 20%');
  });

  it('are raised by Vigilante, which leaves white hits alone', () => {
    expect(describeTiers(0.2, [VIGILANTE])).toBe('0: 80%, 1: 14%, 2: 6%');
    expect(describeTiers(3, [VIGILANTE])).toBe('3: 70%, 4: 30%');
  });

  it('are raised in order', () => {
    expect(describeTiers(0, [PROMOTION, VIGILANTE])).toBe('1: 70%, 2: 30%');
    expect(describeTiers(0, [VIGILANTE, PROMOTION])).toBe('1: 100%');
  });

  it('always add up to 100%, each tier once', () => {
    fc.assert(
      fc.property(critChance, fc.array(raise, { maxLength: 3 }), (chance, raises) => {
        const tiers = critTiers(chance, raises);
        expect(sumOf(tiers)).toBeCloseTo(1, 9);
        expect(tiers.length).toBeLessThanOrEqual(2 + raises.length);
      }),
    );
  });
});

describe('a tier’s multiplier', () => {
  it('at 3x is 1x, 3x, 5x, 7x and 9x', () => {
    expect([0, 1, 2, 3, 4].map((tier) => tierMultiplier(tier, 3))).toEqual([1, 3, 5, 7, 9]);
  });

  it('paris prime with 9 Cold stacks crits for 2.5x and 4x', () => {
    expect([1, 2].map((tier) => tierMultiplier(tier, 2.5))).toEqual([2.5, 4]);
  });

  it('lenz with Vital Sense has orange crits of 7.8x', () => {
    expect(tierMultiplier(2, 2 * 2.2)).toBeCloseTo(7.8, 12);
  });

  it('a headcrit is exactly twice a yellow crit, and more than twice an orange one', () => {
    expect(tierMultiplier(1, 8.8)).toBeCloseTo(2 * tierMultiplier(1, 4.4), 12);
    expect(tierMultiplier(2, 8.8)).toBeCloseTo(16.6, 12);
    expect(tierMultiplier(2, 8.8)).toBeGreaterThan(2 * tierMultiplier(2, 4.4));
  });

  it('is never negative', () => {
    expect(tierMultiplier(3, 0.2)).toBe(0);
  });
});

describe('the expected multiplier', () => {
  it('paris with Point Strike and Vital Sense averages 3.55x', () => {
    expect(expectedCrit(critTiers(0.75), 4.4)).toBeCloseTo(3.55, 12);
  });

  it('is 1 + crit chance x (crit multiplier - 1)', () => {
    fc.assert(
      fc.property(critChance, multiplier, (chance, value) => {
        const expected = 1 + chance * (value - 1);
        expect(expectedCrit(critTiers(chance), value)).toBeCloseTo(expected, 8);
      }),
    );
  });

  it('never drops when tiers are raised', () => {
    fc.assert(
      fc.property(critChance, multiplier, raise, (...[chance, value, more]) => {
        const raised = expectedCrit(critTiers(chance, [more]), value);
        expect(raised).toBeGreaterThanOrEqual(expectedCrit(critTiers(chance), value) - 1e-9);
      }),
    );
  });
});
