import { describe, expect, it } from 'vitest';

import type { HitTrace } from '@/trace/hitTrace';

import { MOST_TRACES, sampleTraces, seriesOf } from './series';

/** A hit at a time, of a share of a pellet that deals 10. */
const hitAt = (at: number, amount = 1) => {
  const trace: HitTrace = {
    t: at,
    pellet: 0,
    factors: [],
    perType: new Map(),
    layer: 'health',
    procs: [],
    dots: [],
  };
  return { at, amount, hit: { total: 10, trace } };
};

describe('damage over time', () => {
  it('has a step for each tenth of a second the fight lasted, 0.1 + 0.2 s too', () => {
    expect(seriesOf([], 1.1).direct).toHaveLength(11);
    expect(seriesOf([], 0.1 + 0.2).direct).toHaveLength(3);
    expect(seriesOf([], 0.05).direct).toHaveLength(1);
  });

  it('has one step for a fight over at once, with the hit that ended it', () => {
    expect(seriesOf([hitAt(0)], 0).direct).toEqual([10]);
  });

  it('puts a hit at a step’s start in that step, though 0.3 ÷ 0.1 is just below 3', () => {
    expect(seriesOf([hitAt(0.3), hitAt(0.29)], 0.4).direct).toEqual([0, 0, 10, 10]);
  });

  it('counts each hit for its share of a pellet', () => {
    expect(seriesOf([hitAt(0, 0.25), hitAt(0.05, 0.5)], 0.1).direct).toEqual([7.5]);
  });
});

describe('the traces kept', () => {
  it('are all of them, up to the most', () => {
    const hits = Array.from({ length: MOST_TRACES }, (_, index) => hitAt(index));
    expect(sampleTraces(hits).map(({ t }) => t)).toEqual(hits.map(({ at }) => at));
  });

  it('are spread evenly over more, from the first to the last', () => {
    const hits = Array.from({ length: 2 * MOST_TRACES + 1 }, (_, index) => hitAt(index));
    const times = sampleTraces(hits).map(({ t }) => t);
    expect(times).toHaveLength(MOST_TRACES);
    expect(times.slice(0, 3)).toEqual([0, 2, 4]);
    expect(times.at(-1)).toBe(2 * MOST_TRACES);
  });
});
