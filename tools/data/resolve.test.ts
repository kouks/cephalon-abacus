import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import type { Assumptions } from '#engine/assumptions.ts';
import { resolveHit } from '#engine/resolve/resolveHit.ts';
import type { Target } from '#engine/resolve/target.ts';
import { findTarget } from '#engine/resolve/target.ts';

import { realAttack, realLibrary as library } from './realAttack.ts';

const DUMMY = findTarget('neutral-dummy', library);

const RUNNER = findTarget('runner', library);

type Shot = {
  readonly modules?: readonly string[];
  readonly on?: 'body' | 'head' | 'monitors';
  readonly target?: Target;
  readonly assumptions?: Partial<Assumptions>;
};

const resolve = (weaponId: string, attackId: string, shot: Shot = {}) => {
  const { modules = [], on = 'body', target = RUNNER, assumptions = {} } = shot;
  const part = must(target.parts.get(on), `No ${on}`);
  const { bodyParts } = part;
  const built = realAttack(weaponId, attackId, { modules, bodyParts, assumptions });
  return resolveHit(built, { target, part, distance: 10 });
};

/** White, yellow and orange, as the game shows them. */
const numbers = (...args: Parameters<typeof resolve>) => {
  const { total, crit } = resolve(...args);
  const white = total / crit.expected;
  return [0, 1, 2].map((tier) => Math.round(white * (1 + tier * (crit.multiplier.value - 1))));
};

describe('every seed weapon', () => {
  const attacks = [...library.weapons.values()].flatMap(({ id, attacks: own }) =>
    own.map((attack) => [id, attack.id] as const),
  );

  it.each(attacks)('%s, %s hits the neutral dummy with a complete trace', (weaponId, attackId) => {
    const { perType, total, trace } = resolve(weaponId, attackId, { target: DUMMY });
    expect(total).toBeGreaterThan(0);
    expect(perType.size).toBeGreaterThan(0);
    for (const [type, damage] of perType) {
      const factors = trace.factors.filter((entry) => (entry.type ?? type) === type);
      expect(factors.reduce((product, { value }) => product * value, 1)).toBeCloseTo(damage, 9);
    }
  });
});

it('every hit on an Obsolyte’s monitors is of a tier more', () => {
  const target = findTarget('techrot-obsolyte', library);
  const tiersOn = (on: 'body' | 'monitors') =>
    resolve('braton', 'normal', { target, on }).tiers.map(({ tier, chance }) => [tier, chance]);
  expect(tiersOn('body')).toEqual([
    [0, 0.88],
    [1, 0.12],
  ]);
  expect(tiersOn('monitors')).toEqual([
    [1, 0.88],
    [2, 0.12],
  ]);
});

it('T-4 rules out that a headcrit doubles only the base', () => {
  const modules = ['serration', 'vital-sense', 'critical-delay'];
  const assumptions = { headcritScalesModded: false };
  const shot = { modules, on: 'head', assumptions } as const;
  expect(numbers('soma-prime', 'normal', shot).slice(1)).toEqual([1145, 2171]);
});
