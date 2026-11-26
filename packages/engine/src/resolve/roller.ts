/**
 * Every random choice the engine makes goes through a Roller, so expected value and Monte Carlo
 * share one code path and differ only here (BIBLE §9).
 */
export type Roller = {
  /** How many times a chance comes up: its whole part, and one more with the chance of the rest. */
  readonly count: (chance: number) => number;
  /** How many of some picks go to each outcome, by weight. Outcomes without a pick are left out. */
  readonly pick: <Key>(
    weights: ReadonlyMap<Key, number>,
    times: number,
  ) => ReadonlyMap<Key, number>;
};

const totalOf = (weights: ReadonlyMap<unknown, number>) =>
  [...weights.values()].reduce((sum, weight) => sum + Math.max(weight, 0), 0);

/** Expected value: a chance comes up as often as it is, and picks share out by weight. */
export const EXPECTED_ROLLER: Roller = {
  count: (chance) => Math.max(chance, 0),
  pick: (weights, times) => {
    const total = totalOf(weights);
    if (total === 0 || times <= 0) return new Map();
    return new Map(
      [...weights]
        .filter(([, weight]) => weight > 0)
        .map(([key, weight]) => [key, (times * weight) / total]),
    );
  },
};

/** The outcome a draw in [0, 1) lands on, walking the weights in order. */
const landOn = <Key>(weights: ReadonlyMap<Key, number>, draw: number): Key | undefined => {
  let left = draw * totalOf(weights);
  for (const [key, weight] of weights) {
    if (left < weight) return key;
    left -= weight;
  }
  return undefined;
};

/** One random outcome at a time, from draws in [0, 1). ABA-27 gives it a seeded source. */
export const drawingRoller = (draw: () => number): Roller => ({
  count: (chance) => {
    const whole = Math.floor(Math.max(chance, 0));
    return whole + (draw() < Math.max(chance, 0) - whole ? 1 : 0);
  },
  pick: <Key>(weights: ReadonlyMap<Key, number>, times: number) => {
    const picked = new Map<Key, number>();
    for (let index = 0; index < times; index += 1) {
      const key = landOn(weights, draw());
      if (key !== undefined) picked.set(key, (picked.get(key) ?? 0) + 1);
    }
    return picked;
  },
});
