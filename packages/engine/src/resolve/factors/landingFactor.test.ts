import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { factorOf, hit } from '@/testing/hit';

/** Penta's explosion. */
const PENTA = { aoe: { radius: 4, centerPct: 1, edgePct: 0.5, losRequired: false } };

const radius = (value: number) => mod('firestorm', [add('aoeRadius', value)]);

type Setup = Parameters<typeof hit>[0];

const landing = (missBy: number, setup: Setup = {}) =>
  factorOf(hit({ attack: PENTA, missBy, ...setup }), 'landing');

const reached = (metres: readonly number[], setup: Setup = {}) =>
  metres.filter((missBy) => landing(missBy, setup).value === 1);

describe('landing beside the target', () => {
  it('leaves nothing of a shot, however close', () => {
    const { total, perType, tiers } = hit({ missBy: 0.01 });
    expect(total).toBe(0);
    expect([...perType.values()]).toEqual([0, 0, 0]);
    expect(tiers.map((tier) => tier.total)).toEqual([0, 0]);
    expect(factorOf(hit({ missBy: 0.01 }), 'landing').effects).toEqual([]);
  });

  it('leaves an explosion up to its radius, and nothing beyond', () => {
    expect(reached([0, 1, 3.99, 4, 4.001, 10])).toEqual([0, 1, 3.99, 4]);
    expect(hit({ attack: PENTA, missBy: 4.001 }).total).toBe(0);
  });

  it('is no matter of how far away the target is', () => {
    expect(reached([4, 4.1], { distance: 500 })).toEqual([4]);
  });
});

it('a shot that hits deals all of it', () => {
  const { total } = hit();
  expect(hit({ missBy: 0 }).total).toBe(total);
  expect(factorOf(hit(), 'landing').value).toBe(1);
});

describe('a wider radius', () => {
  it('reaches further: Penta’s 4 m are 4.96 m with Firestorm', () => {
    expect(reached([4, 4.95, 4.97], { modules: [radius(0.24)] })).toEqual([4, 4.95]);
  });

  it('is named behind the factor', () => {
    const { effects } = landing(1, { modules: [radius(0.24)] });
    expect(effects.map(({ source, value }) => [source.name, value])).toEqual([['firestorm', 0.24]]);
  });

  it('means nothing to a shot without an explosion', () => {
    expect(reached([0, 0.1], { attack: {}, modules: [radius(0.24)] })).toEqual([0]);
  });

  it('can be a smaller one, which still has a centre', () => {
    expect(reached([0, 2, 2.1], { modules: [radius(-0.5)] })).toEqual([0, 2]);
    expect(reached([0, 0.1], { modules: [radius(-1.5)] })).toEqual([0]);
  });
});

it('changes no damage up to the radius, and leaves none beyond', () => {
  const metres = fc.double({ min: 0.1, max: 50, noNaN: true });
  const even = { centerPct: 1, edgePct: 1, losRequired: false };
  const { total } = hit();
  fc.assert(
    fc.property(metres, metres, (...[radiusOf, missBy]) => {
      const found = hit({ attack: { aoe: { ...even, radius: radiusOf } }, missBy }).total;
      expect(found).toBeCloseTo(missBy <= radiusOf ? total : 0, 9);
    }),
  );
});
