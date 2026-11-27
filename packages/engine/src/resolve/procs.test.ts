import { describe, expect, it } from 'vitest';

import { DEFAULT_ASSUMPTIONS } from '@/assumptions';
import { hit } from '@/testing/hit';

import { receivedChance } from './procs';
import { drawingRoller } from './roller';

const procsOf = (attack: object, change: object = {}) =>
  Object.fromEntries(
    hit({ attack, ...change }).trace.procs.map(({ status, count }) => [
      status,
      Number(count.toFixed(9)),
    ]),
  );

const total = (procs: Readonly<Record<string, number>>) =>
  Number(
    Object.values(procs)
      .reduce((sum, count) => sum + count, 0)
      .toFixed(9),
  );

const IMPACT = { damage: { impact: 100 } };

describe('one pellet’s procs, in expected value', () => {
  it.each([0.5, 1.5, 2.5])('come to its status chance of %d', (statusChance) => {
    expect(total(procsOf({ ...IMPACT, statusChance }))).toBe(statusChance);
  });

  it('share out by each type’s quantized weight', () => {
    // 25 and 75 of 100 are 8 and 24 thirty-seconds.
    expect(procsOf({ damage: { impact: 25, heat: 75 }, statusChance: 1 })).toEqual({
      knockback: 0.25,
      ignite: 0.75,
    });
  });

  it('leave out a type quantized to nothing (T-14)', () => {
    expect(Object.keys(procsOf({ damage: { impact: 0.1, slash: 100 }, statusChance: 1 }))).toEqual([
      'bleed',
    ]);
  });
});

describe('one pellet’s procs, drawn', () => {
  it('are whole, and the same type can come up twice above 100%', () => {
    const roller = drawingRoller(() => 0.25);
    expect(procsOf({ ...IMPACT, statusChance: 2.5 }, { roller })).toEqual({ knockback: 3 });
    expect(procsOf({ ...IMPACT, statusChance: 2.2 }, { roller })).toEqual({ knockback: 2 });
  });
});

describe('forced procs', () => {
  const forced = { ...IMPACT, statusChance: 0, forcedProcs: [{ status: 'confusion', count: 1 }] };

  it('come whatever the status chance, besides the rolled ones', () => {
    expect(procsOf(forced)).toEqual({ confusion: 1 });
    expect(procsOf({ ...forced, statusChance: 0.5 })).toEqual({ confusion: 1, knockback: 0.5 });
  });

  it('come only within their reach: Arca Plasmor’s Impact to 14 m', () => {
    const reach = { ...forced, forcedProcs: [{ status: 'confusion', count: 1, within: 14 }] };
    expect(procsOf(reach, { distance: 14 })).toEqual({ confusion: 1 });
    expect(procsOf(reach, { distance: 15 })).toEqual({});
  });
});

describe('Tau’s status chance vulnerability (T-9)', () => {
  it('multiplies the chance a hit brings, by default', () => {
    expect(receivedChance(0.3, 0.3, DEFAULT_ASSUMPTIONS)).toBeCloseTo(0.39, 12);
    expect(total(procsOf({ ...IMPACT, statusChance: 0.3 }, { vulnerability: 0.3 }))).toBe(0.39);
  });

  it('adds points without tauChanceMultiplied', () => {
    expect(receivedChance(0.3, 0.3, { tauChanceMultiplied: false })).toBeCloseTo(0.6, 12);
    const assumptions = { tauChanceMultiplied: false };
    expect(
      total(procsOf({ ...IMPACT, statusChance: 0.3 }, { vulnerability: 0.3, assumptions })),
    ).toBe(0.6);
  });
});
