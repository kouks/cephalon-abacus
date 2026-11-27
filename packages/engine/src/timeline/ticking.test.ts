import { describe, expect, it } from 'vitest';

import { makeTarget } from '@/testing/hit';
import { procOf } from '@/testing/tick';
import type { DotTrace } from '@/trace/hitTrace';

import { firstTicks, nextTick } from './ticking';

const { built } = procOf();

/** A crit tier of a proc a hit inflicts, which ticks at these seconds after it. */
const dotOf = (change: Partial<DotTrace> = {}): DotTrace => ({
  status: 'bleed',
  count: 1,
  tier: 0,
  chance: 1,
  seed: 100,
  factors: [],
  damage: 35.35,
  times: [1, 2, 3],
  ...change,
});

/** The first ticks of a hit at 10 s, of this much of a pellet. */
const ticksOf = (dots: readonly DotTrace[], amount = 1) =>
  firstTicks({ built, amount, hit: { trace: { dots } } }, { at: 10, target: makeTarget() });

describe('the ticks of the procs a hit inflicts (BIBLE §8)', () => {
  it('start at the proc’s first tick after the hit, with the rest to come after it', () => {
    const [first, ...others] = ticksOf([dotOf()]);
    expect(others).toEqual([]);
    expect(first?.at).toBe(11);
    expect(first?.proc.later).toEqual([12, 13]);
  });

  it('are as much of a proc as the hit is of a pellet, the proc of one, and its tier likely', () => {
    const [first] = ticksOf([dotOf({ count: 0.4, chance: 0.25, tier: 1, seed: 200 })], 0.5);
    expect(first?.proc).toMatchObject({ share: 0.05, tier: 1, seed: 200 });
  });

  it('keep the attacker’s side of the tick, which the seed makes: (100 + 1) × 0.35', () => {
    const [first] = ticksOf([dotOf()]);
    const attacker = first?.proc.attacker.reduce((product, { value }) => product * value, 1);
    expect(attacker).toBeCloseTo(101 * 0.35, 12);
  });

  it('are one for each crit tier that can happen, of each status that ticks', () => {
    const dots = [dotOf(), dotOf({ tier: 1 }), dotOf({ status: 'poison', times: [0] })];
    expect(ticksOf(dots).map(({ at, proc }) => [at, proc.dot.status, proc.tier])).toEqual([
      [11, 'bleed', 0],
      [11, 'bleed', 1],
      [10, 'poison', 0],
    ]);
  });

  it('are none of a tier that can’t happen, or of a status that doesn’t tick', () => {
    expect(ticksOf([dotOf({ chance: 0 }), dotOf({ status: 'virus' })])).toEqual([]);
  });

  it('are none of a proc whose time is up before it ticks', () => {
    expect(ticksOf([dotOf({ times: [] })])).toEqual([]);
  });
});

describe('a proc’s next tick', () => {
  it('is the first of those it has left, until it has none', () => {
    const proc = procOf();
    const [next] = nextTick(proc, [3, 4]);
    expect([next?.at, next?.proc.later]).toEqual([3, [4]]);
    expect(nextTick(proc, [])).toEqual([]);
  });
});
