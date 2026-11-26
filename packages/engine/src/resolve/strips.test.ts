import { describe, expect, it } from 'vitest';

import type { Op } from '@abacus/data/schema/effect';

import { DEFAULT_ASSUMPTIONS } from '@/assumptions';
import { totalOf } from '@/build/aggregate';

import type { Rounding } from '@/enemy/whole';

import type { Defence } from './defence';
import { armorMet, STRIPS } from './strips';

const strip = (op: Op, value: number) => ({
  source: { id: `strip-${op}-${value}`, name: 'A strip' },
  bucket: STRIPS,
  op,
  value,
});

const PROJECTION = strip('STACKING_MULTIPLY', -0.18);

type Options = {
  readonly uncapped?: number;
  readonly isCappedFirst?: boolean;
  readonly rounding?: Rounding;
};

const defenceOf = (armor: number, { uncapped, rounding }: Options = {}): Defence => ({
  layer: 'health',
  armor,
  ...(uncapped === undefined ? {} : { uncappedArmor: uncapped }),
  ...(rounding === undefined ? {} : { armorRounding: rounding }),
  left: { overguard: 0, shield: 0, health: 1000 },
  rules: new Map(),
});

const armorAfter = (
  armor: number,
  strips: readonly ReturnType<typeof strip>[],
  { isCappedFirst = true, ...options }: Options = {},
) =>
  armorMet(defenceOf(armor, options), {
    totals: new Map([[STRIPS, totalOf(STRIPS, strips, {})]]),
    assumptions: { ...DEFAULT_ASSUMPTIONS, armorCappedBeforeStrips: isCappedFirst },
  }).value;

describe('strips', () => {
  it('leave armor alone when there are none, and name none', () => {
    const met = armorMet(defenceOf(1000), { totals: new Map(), assumptions: DEFAULT_ASSUMPTIONS });
    expect(met).toEqual({ value: 1000, strips: [] });
  });

  it('of the most armor add up: two Corrosive Projections take 36%', () => {
    expect(armorAfter(1000, [PROJECTION, PROJECTION])).toBeCloseTo(640, 9);
  });

  it('of what is left multiply: Heat’s 50% and Corrosive’s 80% leave 10%', () => {
    const heat = strip('MULTIPLY', -0.5);
    expect(armorAfter(1000, [heat, strip('MULTIPLY', -0.8)])).toBeCloseTo(100, 9);
  });

  it('of the most come first, then of what is left, then flat ones', () => {
    const strips = [strip('ADD', -50), strip('MULTIPLY', -0.5), PROJECTION];
    expect(armorAfter(1000, strips)).toBeCloseTo(1000 * 0.82 * 0.5 - 50, 9);
  });

  it('can take armor below 200, and never below 0', () => {
    expect(armorAfter(200, [strip('STACKING_MULTIPLY', -0.5)])).toBeCloseTo(100, 9);
    expect(armorAfter(200, [strip('STACKING_MULTIPLY', -1.5)])).toBe(0);
  });

  it('name the effects that made them', () => {
    const met = armorMet(defenceOf(1000), {
      totals: new Map([[STRIPS, totalOf(STRIPS, [PROJECTION], {})]]),
      assumptions: DEFAULT_ASSUMPTIONS,
    });
    expect(met.strips.map(({ source }) => source.id)).toEqual(['strip-STACKING_MULTIPLY--0.18']);
  });
});

describe('what strips leave', () => {
  /** T-6 and T-48: a level 60 Lancer's 728 armor, less 18%, is 596.96 and shows as 596. */
  it('is kept whole as the game keeps armor: rounded down', () => {
    expect(armorAfter(728, [PROJECTION], { rounding: 'down' })).toBe(596);
    expect(armorAfter(728, [PROJECTION], { rounding: 'nearest' })).toBe(597);
    expect(armorAfter(728, [PROJECTION])).toBeCloseTo(596.96, 9);
  });
});

/** The wiki's Corrosive Projection page, read 2026-11-26. */
describe('the wiki’s worked examples', () => {
  it('Corrosive Projection and Terrify leave 22% of the armor', () => {
    const terrify = strip('STACKING_MULTIPLY', -0.6);
    expect(armorAfter(1000, [PROJECTION, terrify])).toBeCloseTo(220, 9);
  });

  it('Heat, ten Corrosive stacks and one Corrosive Projection leave 8.2%', () => {
    const strips = [strip('MULTIPLY', -0.5), strip('MULTIPLY', -0.8), PROJECTION];
    expect(armorAfter(1000, strips)).toBeCloseTo(82, 9);
  });
});

describe('the cap of 2,700 (T-6)', () => {
  /** A Heavy Gunner at level 100 would have 6,441 armor, and at level 60 3,017. */
  it('comes before strips, by default: 18% of 2,700 is gone', () => {
    expect(armorAfter(2700, [PROJECTION], { uncapped: 6441.155 })).toBeCloseTo(2214, 9);
  });

  it('comes after them without armorCappedBeforeStrips', () => {
    const after = { isCappedFirst: false } as const;
    expect(armorAfter(2700, [PROJECTION], { ...after, uncapped: 6441.155 })).toBe(2700);
    const at60 = armorAfter(2700, [PROJECTION], { ...after, uncapped: 3017.363 });
    expect(at60).toBeCloseTo(3017.363 * 0.82, 9);
    expect(armorAfter(728, [PROJECTION], after)).toBeCloseTo(728 * 0.82, 9);
  });
});
