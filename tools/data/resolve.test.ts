import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import type { Assumptions } from '#engine/assumptions.ts';
import { resolveHit } from '#engine/resolve/resolveHit.ts';
import type { Target } from '#engine/resolve/target.ts';
import { findTarget } from '#engine/resolve/target.ts';

import { realAttack, realLibrary as library } from './realAttack.ts';

const DUMMY = findTarget('neutral-dummy', library);

/** Infested: 1.5x from Slash and Heat, and no armor. */
const CHARGER: Target = {
  ...DUMMY,
  id: 'charger',
  faction: must(library.factions.get('infested'), 'No Infested'),
};

type Shot = {
  readonly modules?: readonly string[];
  readonly on?: 'body' | 'head';
  readonly target?: Target;
  readonly assumptions?: Partial<Assumptions>;
};

const resolve = (weaponId: string, attackId: string, shot: Shot = {}) => {
  const { modules = [], on = 'body', target = CHARGER, assumptions = {} } = shot;
  const part = must(target.parts.get(on), `No ${on}`);
  const { bodyParts } = part;
  const built = realAttack(weaponId, attackId, { modules, bodyParts, assumptions });
  return resolveHit(built, { target, part });
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

describe('as measured in the game', () => {
  it('T-1: Braton on a Charger', () => {
    expect(numbers('braton', 'normal').slice(0, 2)).toEqual([29, 46]);
  });

  it('T-2: Nagantaka Prime on a Charger', () => {
    const white = (...modules: readonly string[]) =>
      numbers('nagantaka-prime', 'semi-auto', { modules })[0];
    expect([white(), white('serration'), white('crash-course')]).toEqual([251, 666, 257]);
  });

  /** Galvanized Scope was on too, which only makes orange crits possible. */
  const modules = ['serration', 'vital-sense', 'critical-delay'];
  const soma = (shot: Shot) => numbers('soma-prime', 'normal', { modules, ...shot });

  it('T-4: Soma Prime’s white, yellow and orange hits, on the body and the head', () => {
    expect(soma({ on: 'body' })).toEqual([40, 262, 485]);
    expect(soma({ on: 'head' }).slice(1)).toEqual([1574, 3030]);
  });

  it('T-4 rules out that a headcrit doubles only the base', () => {
    const assumptions = { headcritScalesModded: false };
    expect(soma({ on: 'head', assumptions }).slice(1)).toEqual([1145, 2171]);
  });
});
