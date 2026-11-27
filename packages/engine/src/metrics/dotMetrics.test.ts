import { describe, expect, it } from 'vitest';

import { attackOf, BLAST, GRENADE, measureBuild } from '@/testing/metrics';

const always = (damage: object, change: object = {}) => [
  attackOf('normal', { damage, statusChance: 1, ...change }),
];

/** The DoT headline of the test rifle: 8 shots/s, 45 rounds and 540 more, 2 s reload. */
const dotOf = (damage: object, change: object = {}, setup: object = {}) =>
  measureBuild({ attacks: always(damage, change), ...setup }).dot;

const SLASH = 41 * 0.35;
const OTHERS = 41 * 0.5;

describe('what a shot’s procs deal over time, in closed form (BIBLE §8)', () => {
  it.each([
    ['Slash', { slash: 40 }, SLASH],
    ['Toxin', { toxin: 40 }, OTHERS],
    ['Electricity', { electricity: 40 }, OTHERS],
    ['Gas', { gas: 40 }, OTHERS],
  ])('is six ticks of %s per proc, by hand', (_name, damage, tick) => {
    const dot = dotOf(damage);
    expect(dot.perShot).toBeCloseTo(6 * tick, 4);
    expect(dot.burstDps).toBeCloseTo(6 * tick * 8, 4);
    expect(dot.sustainedDps).toBeCloseTo(6 * tick * 8 * (45 / (45 + 8 * 2)), 4);
    expect(dot.lifetimeDamage).toBeCloseTo(6 * tick * 45 * (1 + 540 / 45), 2);
  });

  it('counts each pellet’s share of a proc', () => {
    expect(dotOf({ slash: 40 }, { statusChance: 0.5 }).perShot).toBeCloseTo(3 * SLASH, 4);
    expect(dotOf({ slash: 40 }, { multishot: 2 }).perShot).toBeCloseTo(12 * SLASH, 4);
  });

  it('is three times as much from a 3x head, as the seed is', () => {
    const onHead = { scenario: { aim: { head: 1, body: 0 } } };
    expect(dotOf({ slash: 40 }, {}, onHead).perShot).toBeCloseTo(6 * 121 * 0.35, 4);
  });

  it('is the mean over the crit tiers, each with its own seed', () => {
    const crits = { critChance: 0.5, critMultiplier: 2, flags: ['canHeadshot', 'canCrit'] };
    const yellow = (40 * 2.0005 + 1) * 0.35;
    expect(dotOf({ slash: 40 }, crits).perShot).toBeCloseTo(6 * (0.5 * SLASH + 0.5 * yellow), 3);
  });

  it('is the mean over the parts aimed at', () => {
    const half = { scenario: { aim: { head: 0.5, body: 0.5 } } };
    expect(dotOf({ slash: 40 }, {}, half).perShot).toBeCloseTo(
      6 * 0.35 * (0.5 * 121 + 0.5 * 41),
      3,
    );
  });

  it('adds what the shot sets off: a grenade’s explosion that always bleeds', () => {
    const bleeding = { ...BLAST, statusChance: 0, forcedProcs: [{ status: 'bleed', count: 1 }] };
    const { dot } = measureBuild({ attacks: [{ ...GRENADE, statusChance: 0 }, bleeding] });
    expect(dot.perShot).toBeCloseTo(6 * 351 * 0.35, 2);
  });

  it('counts forced procs', () => {
    const forced = { statusChance: 0, forcedProcs: [{ status: 'bleed', count: 1 }] };
    expect(dotOf({ impact: 40 }, forced).perShot).toBeCloseTo(6 * SLASH, 4);
  });

  it('takes what the statuses on the enemy do to ticks: Viral at 10', () => {
    const enemy = { id: 'neutral-dummy', level: 1, steelPath: false, modifiers: [] };
    const viral = { scenario: { enemy: { ...enemy, statuses: { virus: 10 } } } };
    expect(dotOf({ slash: 40 }, {}, viral).perShot).toBeCloseTo(6 * SLASH * 4.25, 3);
  });

  it('is nothing without status chance or forced procs', () => {
    expect(dotOf({ slash: 40 }, { statusChance: 0 })).toEqual({
      perShot: 0,
      burstDps: 0,
      sustainedDps: 0,
      lifetimeDamage: 0,
    });
  });

  it('is never in the direct numbers', () => {
    const procs = measureBuild({ attacks: always({ slash: 40 }) });
    const none = measureBuild({ attacks: always({ slash: 40 }, { statusChance: 0 }) });
    expect([procs.perShot, procs.lifetimeDamage]).toEqual([none.perShot, none.lifetimeDamage]);
    expect(procs.dot.perShot).toBeGreaterThan(0);
  });

  it('is of the firing mode the headline is for', () => {
    const { dot, byAttack } = measureBuild({ attacks: always({ slash: 40 }) });
    expect(dot).toEqual(byAttack[0]?.dot);
  });
});
