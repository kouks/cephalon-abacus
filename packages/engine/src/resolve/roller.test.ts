import { describe, expect, it } from 'vitest';

import { drawingRoller, EXPECTED_ROLLER } from './roller';

/** Draws that come back in turn. */
const drawing = (...draws: readonly number[]) => {
  let index = 0;
  return drawingRoller(() => draws[index++ % draws.length] ?? 0);
};

/** Every draw from 0 to 1 in even steps, so a mean is exact. */
const even = (steps: number) =>
  drawing(...Array.from({ length: steps }, (_, index) => index / steps));

const WEIGHTS = new Map([
  ['a', 1],
  ['b', 3],
  ['none', 0],
]);

describe('the expected-value roller', () => {
  it('counts a chance as it is, and nothing below 0', () => {
    expect([0.5, 1.5, 2.5, -1].map((chance) => EXPECTED_ROLLER.count(chance))).toEqual([
      0.5, 1.5, 2.5, 0,
    ]);
  });

  it('shares picks out by weight, leaving out what has none', () => {
    expect([...EXPECTED_ROLLER.pick(WEIGHTS, 2)]).toEqual([
      ['a', 0.5],
      ['b', 1.5],
    ]);
    expect(EXPECTED_ROLLER.pick(new Map([['a', 0]]), 2).size).toBe(0);
    expect(EXPECTED_ROLLER.pick(WEIGHTS, 0).size).toBe(0);
  });
});

describe('a roller that draws', () => {
  it('counts the whole part of a chance, and one more with the chance of the rest', () => {
    expect([drawing(0.299).count(1.3), drawing(0.301).count(1.3)]).toEqual([2, 1]);
    expect([drawing(0.49).count(0.5), drawing(0.5).count(0.5), drawing(0).count(0)]).toEqual([
      1, 0, 0,
    ]);
  });

  it('picks by weight, one draw a pick, and can pick an outcome twice', () => {
    expect([...drawing(0.2, 0.3, 0.9).pick(WEIGHTS, 3)]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('comes to the expected value on average', () => {
    // 2.375 is exact in binary, so even draws land on its mean exactly.
    const counts = Array.from({ length: 200 }, (_, index) => drawing(index / 200).count(2.375));
    expect(counts.reduce((sum, count) => sum + count, 0) / 200).toBe(2.375);
    const picks = even(400).pick(WEIGHTS, 400);
    expect([picks.get('a'), picks.get('b'), picks.get('none')]).toEqual([100, 300, undefined]);
  });
});
