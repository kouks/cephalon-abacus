import { describe, expect, it } from 'vitest';

import { enemy } from '@abacus/data/testing/fixtures';

import { PRIMARY_ACUITY } from '@/testing/build';
import type { HitTrace } from '@/trace/hitTrace';
import { attackOf, BLAST, GRENADE, measureBuild, simulateBuild } from '@/testing/metrics';
import { MOST_TRACES } from '@/timeline/series';

/** The test rifle without procs: 103.125 a shot, 8 shots/s, 45 rounds, 2 s to reload. */
const PLAIN = attackOf('normal', { statusChance: 0 });
const SHOT = 103.125;

/** A magazine and its reload, in seconds. */
const CYCLE = 45 / 8 + 2;

/** Just short of some whole cycles, so the shot that would start the next isn't in it. */
const cycles = (count: number, cycle = CYCLE) => ({ duration: count * cycle - 1e-6 });

const DUMMY = { id: 'neutral-dummy', level: 1, steelPath: false, modifiers: [] };
const TARGET = { ...enemy, id: 'target', baseHealth: 1000 };

/** On the test Grineer, whose Impact takes 1.5x: 31.25 × 1.5 + 31.25 Puncture + 40.625 Slash. */
const ON_GRINEER = 31.25 * 1.5 + 31.25 + 40.625;
const ON_TARGET = { enemy: { ...DUMMY, id: 'target' } };

const amplifierOf = ({ factors }: HitTrace) =>
  factors.find(({ name }) => name === 'amplifier')?.value;

describe('a fight over time (BIBLE §9)', () => {
  it('deals the closed form’s sustained DPS over whole cycles, without procs', () => {
    const setup = { attacks: [PLAIN] };
    const { direct, lasted } = simulateBuild({ ...setup, scenario: cycles(4) });
    expect(lasted).toBeCloseTo(4 * CYCLE, 5);
    expect(direct / (4 * CYCLE)).toBeCloseTo(measureBuild(setup).sustainedDps, 9);
  });

  it('deals as much a shot as the closed form, with bonuses on the head alone', () => {
    const attack = { ...PLAIN, critChance: 0.2, flags: ['canHeadshot', 'canCrit'] };
    const setup = {
      attacks: [attack],
      modules: [PRIMARY_ACUITY],
      scenario: { aim: { head: 0.5, body: 0.5 }, duration: 0.1 },
    };
    expect(simulateBuild(setup).direct).toBeCloseTo(measureBuild(setup).perShot, 9);
  });

  it('strikes with what a shot sets off, where the shot lands: an explosion beside a miss', () => {
    const setup = {
      attacks: [
        { ...GRENADE, statusChance: 0 },
        { ...BLAST, statusChance: 0 },
      ],
      scenario: { aim: { head: 0, body: 1, missBy: 1 }, duration: 0.1 },
    };
    const { perShot } = measureBuild(setup);
    expect(perShot).toBeGreaterThan(0);
    expect(simulateBuild(setup).direct).toBeCloseTo(perShot, 9);
  });

  it('sets off nothing when the shot falls short: a grenade that reaches 5 m, at 10 m', () => {
    const setup = {
      attacks: [
        { ...GRENADE, statusChance: 0, range: 5 },
        { ...BLAST, statusChance: 0 },
      ],
      scenario: { duration: 0.1 },
    };
    expect(measureBuild(setup).perShot).toBe(0);
    expect(simulateBuild(setup).direct).toBe(0);
  });

  it('counts the share of a shot that ends a magazine for its share: 22.5 shots a magazine', () => {
    const setup = { attacks: [{ ...PLAIN, ammoCost: 2 }] };
    const cycle = 22.5 / 8 + 2;
    const { direct } = simulateBuild({ ...setup, scenario: cycles(3, cycle) });
    expect(direct / (3 * cycle)).toBeCloseTo(measureBuild(setup).sustainedDps, 9);
  });

  it('kills 1,000 health with the 9th shot of 118.75, at 8 ÷ 8 s, and stops there', () => {
    const setup = { attacks: [PLAIN], enemies: [TARGET], scenario: ON_TARGET };
    expect(measureBuild(setup).perShot).toBeCloseTo(ON_GRINEER, 9);
    const fight = simulateBuild(setup);
    expect(fight.enemy?.health.value).toBe(1000);
    expect(fight.timeToKill).toBeCloseTo(1, 12);
    expect(fight.lasted).toBeCloseTo(1, 12);
    expect(fight.direct).toBeCloseTo(9 * ON_GRINEER, 9);
    expect(fight.trace).toHaveLength(9);
  });

  it('can be over with the first shot, at 0 s', () => {
    const fragile = { ...TARGET, baseHealth: 50 };
    const fight = simulateBuild({ attacks: [PLAIN], enemies: [fragile], scenario: ON_TARGET });
    expect(fight.timeToKill).toBe(0);
    expect(fight.series.direct).toEqual([ON_GRINEER]);
  });

  it('puts each hit in the tenth of a second it lands in, the last at the end in the last', () => {
    const { series } = simulateBuild({ attacks: [PLAIN], enemies: [TARGET], scenario: ON_TARGET });
    expect(series.step).toBe(0.1);
    expect(series.direct.map((damage) => damage / ON_GRINEER)).toEqual([
      1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
    ]);
    expect(series.dot).toEqual(Array.from({ length: 10 }, () => 0));
  });

  it('has no time-to-kill when the enemy lives through it', () => {
    const fight = simulateBuild({ attacks: [PLAIN], scenario: { duration: 1 } });
    expect(fight).not.toHaveProperty('timeToKill');
    expect(fight.lasted).toBe(1);
    expect(fight.series.direct).toHaveLength(10);
    expect(fight.direct).toBeCloseTo(8 * SHOT, 9);
  });

  it('keeps the statuses the scenario puts on the enemy all fight: Viral at 10', () => {
    const viral = { enemy: { ...DUMMY, statuses: { virus: 10 } } };
    const setup = { attacks: [PLAIN], scenario: { ...viral, duration: 30 } };
    const { direct, series } = simulateBuild(setup);
    expect(series.direct[0]).toBeCloseTo(measureBuild(setup).perShot, 9);
    expect(direct).toBeCloseTo(4 * 45 * 4.25 * SHOT, 6);
  });

  it('has the procs of a shot change the shots after it, until they end', () => {
    const forced = { ...PLAIN, forcedProcs: [{ status: 'virus', count: 1 }] };
    const often = simulateBuild({ attacks: [forced], scenario: { duration: 0.3 } });
    expect(often.trace.map(amplifierOf)).toEqual([1, 2, 2.25]);
    const rarely = simulateBuild({
      attacks: [{ ...forced, fireRate: 0.1 }],
      scenario: { duration: 15 },
    });
    expect(rarely.series.direct.filter((damage) => damage > 0)).toEqual([SHOT, SHOT]);
  });

  it('keeps some of the hits’ traces in a long fight, the first and last among them', () => {
    const { trace } = simulateBuild({ attacks: [PLAIN], scenario: { duration: 60 } });
    expect(trace).toHaveLength(MOST_TRACES);
    expect(trace[0]?.t).toBe(0);
    expect(trace.at(-1)?.t).toBeCloseTo(7 * CYCLE + 44 / 8, 9);
  });

  it('has the closed form’s warnings and firing mode', () => {
    const spool = { ...PLAIN, trigger: 'autoSpool', spool: { shotsToMax: 4 } };
    const fight = simulateBuild({ attacks: [spool], scenario: { duration: 1 } });
    expect(fight.attackId).toBe('normal');
    expect(fight.warnings).toEqual(measureBuild({ attacks: [spool] }).warnings);
    expect(fight.warnings).not.toEqual([]);
  });
});
