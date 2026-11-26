import { describe, expect, it } from 'vitest';

import type { LayersLeft } from './applyHit';
import type { Defence } from './defence';

import { dealt, LAYER_RULES, WEAK_POINT } from '@/testing/hit';

const defenceWith = (left: Partial<LayersLeft>): Defence => ({
  layer: 'health',
  armor: 0,
  rules: LAYER_RULES,
  left: { overguard: 0, shield: 0, health: 1000, ...left },
});

/** The white hit of an attack that never crits. */
const whiteOf = (damage: object, left: Partial<LayersLeft>, rest: object = {}) =>
  dealt({ attack: { damage, critChance: 0 }, defence: defenceWith(left), ...rest })[0];

const rounded = (tier: ReturnType<typeof whiteOf>) =>
  tier?.dealt.map(({ layer, shown, applied }) => [layer, shown, Number(applied.toFixed(6))]);

describe('one hit on the layers in order', () => {
  it('meets each layer as that layer takes it: Toxin passes shields', () => {
    const white = whiteOf({ impact: 50, toxin: 50 }, { shield: 1000 });
    expect(rounded(white)).toEqual([
      ['shield', 50, 50],
      ['health', 50, 50],
    ]);
    expect(white?.left).toEqual({ overguard: 0, shield: 950, health: 950 });
  });

  it('lets 5% of the rest past shields on the body, and all of it on a weak point', () => {
    const left = { shield: 50 };
    expect(rounded(whiteOf({ impact: 100 }, left))).toEqual([
      ['shield', 97, 50],
      ['health', 3, 2.5],
    ]);
    const weakPoint = dealt(
      { attack: { damage: { impact: 100 }, critChance: 0 }, defence: defenceWith(left) },
      WEAK_POINT,
    )[0];
    expect(rounded(weakPoint)).toEqual([
      ['shield', 50, 50],
      ['health', 50, 50],
    ]);
  });

  it('has a row for each crit tier', () => {
    const tiers = dealt({ attack: { critChance: 1.5 }, defence: defenceWith({}) });
    expect(tiers.map(({ tier, chance }) => [tier, chance])).toEqual([
      [1, 0.5],
      [2, 0.5],
    ]);
  });

  describe('a broken Overguard, which takes 1.5x of Void (T-44)', () => {
    const left = { overguard: 100, shield: 1000 };

    it('shows what it had left, by default', () => {
      expect(rounded(whiteOf({ void: 100 }, left))).toEqual([
        ['overguard', 100, 100],
        ['shield', 33, 33.333333],
      ]);
    });

    it('shows the hit less what shields show, without breakShownInOwnTerms', () => {
      const assumptions = { breakShownInOwnTerms: false };
      expect(rounded(whiteOf({ void: 100 }, left, { assumptions }))?.[0]).toEqual([
        'overguard',
        117,
        100,
      ]);
    });
  });
});
