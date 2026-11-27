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

const hitsOnly = (hits: readonly ReturnType<typeof hitAt>[]) => ({ hits, ticks: [] });

describe('damage over time', () => {
  it('has a step for each tenth of a second the fight lasted, 0.1 + 0.2 s too', () => {
    expect(seriesOf(hitsOnly([]), 1.1).direct).toHaveLength(11);
    expect(seriesOf(hitsOnly([]), 0.1 + 0.2).direct).toHaveLength(3);
    expect(seriesOf(hitsOnly([]), 0.05).dot).toHaveLength(1);
  });

  it('has one step for a fight over at once, with the hit that ended it', () => {
    expect(seriesOf(hitsOnly([hitAt(0)]), 0).direct).toEqual([10]);
  });

  it('puts a hit at a step’s start in that step, though 0.3 ÷ 0.1 is just below 3', () => {
    expect(seriesOf(hitsOnly([hitAt(0.3), hitAt(0.29)]), 0.4).direct).toEqual([0, 0, 10, 10]);
  });

  it('counts each hit for its share of a pellet', () => {
    expect(seriesOf(hitsOnly([hitAt(0, 0.25), hitAt(0.05, 0.5)]), 0.1).direct).toEqual([7.5]);
  });

  it('has the ticks apart from the hits, each for its share of a proc', () => {
    const ticks = [
      { t: 0, share: 0.5, damage: 4 },
      { t: 0.15, share: 1, damage: 3 },
    ];
    const series = seriesOf({ hits: [hitAt(0.1)], ticks }, 0.2);
    expect(series.direct).toEqual([0, 10]);
    expect(series.dot).toEqual([2, 3]);
  });
});

describe('the traces kept', () => {
  const tracesOf = (count: number) =>
    Array.from({ length: count }, (_, index) => hitAt(index).hit.trace);

  it('are all of them, up to the most', () => {
    const traces = tracesOf(MOST_TRACES);
    expect(sampleTraces(traces)).toEqual(traces);
  });

  it('are spread evenly over more, from the first to the last', () => {
    const times = sampleTraces(tracesOf(2 * MOST_TRACES + 1)).map(({ t }) => t);
    expect(times).toHaveLength(MOST_TRACES);
    expect(times.slice(0, 3)).toEqual([0, 2, 4]);
    expect(times.at(-1)).toBe(2 * MOST_TRACES);
  });
});
