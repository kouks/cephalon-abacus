import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { factorOf, hit, shot } from '@/testing/hit';

/** Penta's and Ogris' explosions. */
const PENTA = { radius: 4, centerPct: 1, edgePct: 0.5, losRequired: false };
const OGRIS = { radius: 7.1, centerPct: 1, edgePct: 0.2, losRequired: false };

const radius = (value: number) => mod('firestorm', [add('aoeRadius', value)]);

type Setup = Parameters<typeof hit>[0];

const radialAt = (missBy: number, aoe: object, setup: Setup = {}) =>
  factorOf(hit({ attack: { aoe }, missBy, ...setup }), 'radialFalloff');

const sharesAt = (metres: readonly number[], aoe: object, setup: Setup = {}) =>
  metres.map((missBy) => Number(radialAt(missBy, aoe, setup).value.toFixed(12)));

describe('an explosion', () => {
  it('of Penta, with 50% falloff, drops along a square root to nothing at its 4 m', () => {
    expect(sharesAt([0, 1, 2, 3, 3.84, 4], PENTA)).toEqual(
      [1, Math.sqrt(0.75), Math.SQRT1_2, 0.5, 0.2, 0].map((share) => Number(share.toFixed(12))),
    );
  });

  it('of Ogris, with 80% falloff over 7.1 m, has 57.4% left halfway', () => {
    expect(sharesAt([0, 3.55, 7.1], OGRIS)).toEqual([1, 0.574349177499, 0]);
  });

  it('drops in a straight line with 100% falloff', () => {
    expect(sharesAt([0, 1, 3, 4], { ...PENTA, edgePct: 0 })).toEqual([1, 0.75, 0.25, 0]);
  });

  it('can be weaker than all of it in its centre', () => {
    const weak = { ...PENTA, centerPct: 0.8, edgePct: 0.4 };
    expect(sharesAt([0, 3, 4], weak)).toEqual([0.8, 0.4, 0]);
  });

  it('without falloff is even all over: Vectis Incarnon, Zakti', () => {
    expect(sharesAt([0, 3, 6.7], { ...PENTA, radius: 6.7, edgePct: 1 })).toEqual([1, 1, 1]);
  });

  it('lowers all damage alike', () => {
    const at = (missBy: number) => hit({ attack: { aoe: PENTA }, missBy });
    expect(at(3).total / at(0).total).toBeCloseTo(0.5, 12);
    for (const [type, damage] of at(3).perType) {
      expect(damage / (at(0).perType.get(type) ?? 0)).toBeCloseTo(0.5, 12);
    }
  });

  it('counts in a shot', () => {
    const attack = { aoe: PENTA, flags: ['isAoE'] };
    const at = (missBy?: number) =>
      shot({ attack, aim: { head: 0, body: 1, ...(missBy === undefined ? {} : { missBy }) } });
    expect(at(3).total / at().total).toBeCloseTo(0.5, 12);
    expect(at(4.1).total).toBe(0);
  });
});

it('a shot without an explosion has none', () => {
  const none = { name: 'radialFalloff', value: 1, effects: [] };
  expect(factorOf(hit({ modules: [radius(0.24)] }), 'radialFalloff')).toEqual(none);
});

describe('a wider radius', () => {
  it('stretches it all: Penta’s half at 3 m is at 4.32 m with Primed Firestorm', () => {
    expect(sharesAt([4.32, 5.76], PENTA, { modules: [radius(0.44)] })).toEqual([0.5, 0]);
  });

  it('is named behind the factor', () => {
    const { effects } = radialAt(2, PENTA, { modules: [radius(0.44)] });
    expect(effects.map(({ source }) => source.name)).toEqual(['firestorm']);
  });

  it('can be none at all, which leaves the centre as it is', () => {
    expect(sharesAt([0, 1], PENTA, { modules: [radius(-1)] })).toEqual([1, 0]);
    expect(sharesAt([0, 1], PENTA, { modules: [radius(-2)] })).toEqual([1, 0]);
  });
});

const metres = fc.double({ min: 0, max: 10, noNaN: true });
const edge = fc.double({ min: 0, max: 1, noNaN: true });

it('never grows with distance, whatever its falloff', () => {
  fc.assert(
    fc.property(metres, metres, edge, (...[one, other, edgePct]) => {
      const [near, far] = one < other ? [one, other] : [other, one];
      const totalAt = (missBy: number) =>
        hit({ attack: { aoe: { ...OGRIS, edgePct } }, missBy }).total;
      expect(totalAt(far)).toBeLessThanOrEqual(totalAt(near) + 1e-9);
    }),
  );
});

it('a wider radius never lowers the damage', () => {
  const bonus = fc.double({ min: 0, max: 3, noNaN: true });
  fc.assert(
    fc.property(metres, bonus, edge, (...[missBy, value, edgePct]) => {
      const setup = { attack: { aoe: { ...OGRIS, edgePct } }, missBy };
      const wider = hit({ ...setup, modules: [radius(value)] }).total;
      expect(wider).toBeGreaterThanOrEqual(hit(setup).total - 1e-9);
    }),
  );
});
