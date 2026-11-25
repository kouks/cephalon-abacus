import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { factorOf, hit, shot } from '@/testing/hit';

/** Penta's and Ogris' explosions. */
const PENTA = { radius: 4, centerPct: 1, edgePct: 0.5, losRequired: false };
const OGRIS = { radius: 7.1, centerPct: 1, edgePct: 0.2, losRequired: false };

const TO_ZERO = { assumptions: { radialFalloffHeadsForZero: true } };

const radius = (value: number) => mod('firestorm', [add('aoeRadius', value)]);

type Setup = Parameters<typeof hit>[0];

const radialAt = (missBy: number, aoe: object, setup: Setup = {}) =>
  factorOf(hit({ attack: { aoe }, missBy, ...setup }), 'radialFalloff');

const sharesAt = (metres: readonly number[], aoe: object, setup: Setup = {}) =>
  metres.map((missBy) => Number(radialAt(missBy, aoe, setup).value.toFixed(12)));

describe('an explosion', () => {
  it('of Penta, 100% to 50%, drops in a straight line to its 4 m', () => {
    expect(sharesAt([0, 1, 2, 3, 4], PENTA)).toEqual([1, 0.875, 0.75, 0.625, 0.5]);
  });

  it('of Ogris, 100% to 20% over 7.1 m, is at 60% halfway', () => {
    expect(sharesAt([0, 3.55, 7.1], OGRIS)).toEqual([1, 0.6, 0.2]);
  });

  it('would meet the least on the way if its line headed for zero, as a shot’s does', () => {
    expect(sharesAt([0, 1, 2, 3, 4], PENTA, TO_ZERO)).toEqual([1, 0.75, 0.5, 0.5, 0.5]);
    expect(sharesAt([3.55, 5.68, 6, 7.1], OGRIS, TO_ZERO)).toEqual([0.5, 0.2, 0.2, 0.2]);
  });

  it('can be weaker than all of it in its centre', () => {
    const weak = { ...PENTA, centerPct: 0.8 };
    expect(sharesAt([0, 2, 4], weak)).toEqual([0.8, 0.65, 0.5]);
    expect(sharesAt([0, 1, 4], weak, TO_ZERO)).toEqual([0.8, 0.6, 0.5]);
  });

  it('can be even all over: Vectis Incarnon', () => {
    expect(sharesAt([0, 3, 6.7], { ...PENTA, radius: 6.7, edgePct: 1 })).toEqual([1, 1, 1]);
  });

  it('lowers all damage alike', () => {
    const at = (missBy: number) => hit({ attack: { aoe: PENTA }, missBy });
    expect(at(2).total / at(0).total).toBeCloseTo(0.75, 12);
    for (const [type, damage] of at(2).perType) {
      expect(damage / (at(0).perType.get(type) ?? 0)).toBeCloseTo(0.75, 12);
    }
  });

  it('counts in a shot', () => {
    const attack = { aoe: PENTA, flags: ['isAoE'] };
    const at = (missBy?: number) =>
      shot({ attack, aim: { head: 0, body: 1, ...(missBy === undefined ? {} : { missBy }) } });
    expect(at(2).total / at().total).toBeCloseTo(0.75, 12);
    expect(at(4.1).total).toBe(0);
  });
});

it('a shot without an explosion has none', () => {
  const none = { name: 'radialFalloff', value: 1, effects: [] };
  expect(factorOf(hit({ modules: [radius(0.24)] }), 'radialFalloff')).toEqual(none);
});

describe('a wider radius', () => {
  it('stretches the line: at 2 m Penta keeps more with Primed Firestorm', () => {
    const modules = [radius(0.44)];
    expect(sharesAt([2.88, 5.76], PENTA, { modules })).toEqual([0.75, 0.5]);
    expect(sharesAt([2.88, 5.76], PENTA, { modules, ...TO_ZERO })).toEqual([0.5, 0.5]);
  });

  it('is named behind the factor', () => {
    const { effects } = radialAt(2, PENTA, { modules: [radius(0.44)] });
    expect(effects.map(({ source }) => source.name)).toEqual(['firestorm']);
  });

  it('can be none at all, which leaves the centre as it is', () => {
    expect(sharesAt([0, 1], PENTA, { modules: [radius(-1)] })).toEqual([1, 0.5]);
    expect(sharesAt([0, 1], PENTA, { modules: [radius(-2)] })).toEqual([1, 0.5]);
  });
});

const metres = fc.double({ min: 0, max: 10, noNaN: true });

it('never grows with distance, whichever line it follows', () => {
  fc.assert(
    fc.property(metres, metres, fc.boolean(), (...[one, other, radialFalloffHeadsForZero]) => {
      const [near, far] = one < other ? [one, other] : [other, one];
      const assumptions = { radialFalloffHeadsForZero };
      const totalAt = (missBy: number) =>
        hit({ attack: { aoe: OGRIS }, missBy, assumptions }).total;
      expect(totalAt(far)).toBeLessThanOrEqual(totalAt(near) + 1e-9);
    }),
  );
});

it('a wider radius never lowers the damage', () => {
  const bonus = fc.double({ min: 0, max: 3, noNaN: true });
  fc.assert(
    fc.property(metres, bonus, fc.boolean(), (...[missBy, value, radialFalloffHeadsForZero]) => {
      const setup = { attack: { aoe: OGRIS }, missBy, assumptions: { radialFalloffHeadsForZero } };
      const wider = hit({ ...setup, modules: [radius(value)] }).total;
      expect(wider).toBeGreaterThanOrEqual(hit(setup).total - 1e-9);
    }),
  );
});
