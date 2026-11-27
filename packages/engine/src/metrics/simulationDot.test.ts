import { describe, expect, it } from 'vitest';

import { enemy } from '@abacus/data/testing/fixtures';

import { attackOf, BLAST, GRENADE, measureBuild, simulateBuild } from '@/testing/metrics';
import type { TickTrace } from '@/trace/hitTrace';
import { MOST_TRACES } from '@/timeline/series';

/** A bleed of the test rifle's 40 Slash, (40 + 1) × 0.35 a tick in binary32; Electricity's is × 0.5. */
const BLEED = Math.fround(41 * Math.fround(0.35));
const ZAP = 41 * 0.5;

/** One shot, and none for the next 100 s. */
const ONCE = { fireRate: 0.01 };

const slashing = (change: object = {}) =>
  attackOf('normal', { damage: { slash: 40 }, statusChance: 1, ...change });

/** A shot that always inflicts these statuses, and rolls none. */
const forcing = (statuses: readonly string[], change: object = {}) =>
  slashing({
    statusChance: 0,
    forcedProcs: statuses.map((status) => ({ status, count: 1 })),
    ...change,
  });

const amplifierOf = ({ factors }: TickTrace) =>
  factors.find(({ name }) => name === 'amplifier')?.value;

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

type Setup = { readonly attacks: readonly object[]; readonly scenario?: object };

/** One shot of each, which has the time for all its procs' ticks. */
const ONE_SHOTS: readonly (readonly [string, Setup])[] = [
  ['a bleed', { attacks: [slashing(ONCE)] }],
  [
    'Electricity, from its proc on',
    { attacks: [slashing({ ...ONCE, damage: { electricity: 40 } })] },
  ],
  [
    'half a proc on each of two pellets',
    { attacks: [slashing({ ...ONCE, statusChance: 0.5, multishot: 2 })] },
  ],
  [
    'a crit tier’s seed',
    { attacks: [slashing({ ...ONCE, critChance: 0.5, flags: ['canHeadshot', 'canCrit'] })] },
  ],
  ['the head’s 3x', { attacks: [slashing(ONCE)], scenario: { aim: { head: 0.5, body: 0.5 } } }],
  [
    'what a shot sets off',
    {
      attacks: [
        { ...GRENADE, ...ONCE },
        { ...BLAST, statusChance: 0, forcedProcs: [{ status: 'bleed', count: 1 }] },
      ],
    },
  ],
];

describe('the ticks of a fight over time (BIBLE §8, §9)', () => {
  it.each(ONE_SHOTS)(
    'deal what the closed form says a shot’s procs deal, given the time: %s',
    (_name, { attacks, scenario = {} }) => {
      const fight = simulateBuild({ attacks, scenario: { duration: 7, ...scenario } });
      const { perShot } = measureBuild({ attacks, scenario }).dot;
      expect(perShot).toBeGreaterThan(0);
      expect(fight.dot).toBeCloseTo(perShot, 9);
    },
  );

  it('deal the closed form’s sustained DoT DPS once ticks keep up: a cycle of 7 s from 7 s', () => {
    const setup = { attacks: [slashing({ fireRate: 9 })] };
    const { series } = simulateBuild({ ...setup, scenario: { duration: 14.05 } });
    const cycle = sum(series.dot.slice(70, 140));
    expect(cycle / 7).toBeCloseTo(measureBuild(setup).dot.sustainedDps, 9);
    expect(cycle).toBeCloseTo(45 * 6 * BLEED, 6);
  });

  it('are those before the end of the fight', () => {
    const fight = simulateBuild({ attacks: [slashing(ONCE)], scenario: { duration: 3.5 } });
    expect(fight.ticks.map(({ t }) => t)).toEqual([1, 2, 3]);
    expect(fight.dot).toBeCloseTo(3 * BLEED, 9);
  });

  it('meet the Viral on the enemy when they land: more with a later shot’s, less once it ends', () => {
    const attacks = [forcing(['bleed', 'virus'], { fireRate: 0.3 })];
    const { ticks } = simulateBuild({ attacks, scenario: { duration: 6.5 } });
    expect(ticks.map((tick) => `${tick.t.toFixed(3)} ×${amplifierOf(tick)}`)).toEqual([
      '1.000 ×2',
      '2.000 ×2',
      '3.000 ×2',
      '4.000 ×2.25',
      '4.333 ×2.25',
      '5.000 ×2.25',
      '5.333 ×2.25',
      '6.000 ×2',
      '6.333 ×2',
    ]);
  });

  it.each([
    ['before', ['virus', 'tesla-chain']],
    ['after', ['tesla-chain', 'virus']],
  ])(
    'of Electricity meet the Viral of the same hit from the first, which comes at once: %s it',
    (_name, statuses) => {
      const attacks = [forcing(statuses, ONCE)];
      const { ticks, dot } = simulateBuild({ attacks, scenario: { duration: 7 } });
      expect(ticks.map(({ t }) => t)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(ticks.map(amplifierOf)).toEqual([2, 2, 2, 2, 2, 2]);
      expect(dot).toBeCloseTo(6 * 2 * ZAP, 9);
      expect(measureBuild({ attacks }).dot.perShot).toBeCloseTo(6 * ZAP, 9);
    },
  );

  it('can kill: 100 health, 40 from the shot and the rest by the 5th tick, at 5 s', () => {
    const target = { ...enemy, id: 'target', baseHealth: 100 };
    const onTarget = { enemy: { id: 'target', level: 1, steelPath: false, modifiers: [] } };
    const fight = simulateBuild({
      attacks: [forcing(['bleed'], ONCE)],
      enemies: [target],
      scenario: onTarget,
    });
    expect(fight.direct).toBe(40);
    expect(fight.timeToKill).toBe(5);
    expect(fight.ticks).toHaveLength(5);
    expect(fight.dot).toBeCloseTo(5 * BLEED, 9);
  });

  it('have a series of their own, apart from the hits', () => {
    const { series, direct } = simulateBuild({
      attacks: [slashing(ONCE)],
      scenario: { duration: 7 },
    });
    expect(series.direct.filter((damage) => damage > 0)).toEqual([direct]);
    expect(
      series.dot.map((damage, step) => (damage > 0 ? step : -1)).filter((step) => step >= 0),
    ).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('keep some of their traces in a long fight, the first and last among them', () => {
    const { ticks } = simulateBuild({ attacks: [slashing()], scenario: { duration: 30 } });
    expect(ticks).toHaveLength(MOST_TRACES);
    expect(ticks[0]?.t).toBe(1);
  });
});
