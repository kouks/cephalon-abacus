import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { BODY, factorOf, hit, shot } from '@/testing/hit';

const TIGRIS = { start: 10, end: 20, minPct: 0.5128 };
const EXERGIS = { start: 30, end: 60, minPct: 0.492 };

const speed = (value: number) => mod('speed', [add('projectileSpeed', value)]);

const ON_THE_WIKI = { assumptions: { falloffHeadsForZero: false } };

const shareAt = (distance: number, falloff: object, setup: Parameters<typeof hit>[0] = {}) =>
  factorOf(hit({ attack: { falloff }, distance, ...setup }), 'falloff').value;

const round = (share: number) => Number(share.toFixed(12));

describe('falloff', () => {
  it.each([
    [0, 1],
    [10, 1],
    [12.5, 0.75],
    [14.5, 0.55],
    [14.872, 0.5128],
    [15, 0.5128],
    [20, 0.5128],
    [30, 0.5128],
  ])('of Tigris Prime at %d m leaves %d', (distance, share) => {
    expect(shareAt(distance, TIGRIS)).toBeCloseTo(share, 12);
  });

  it('of Exergis, 30 to 60 m, meets its 49.2% before 60 m', () => {
    const shares = [30, 45, 45.24, 60].map((distance) => shareAt(distance, EXERGIS));
    expect(shares.map(round)).toEqual([1, 0.5, 0.492, 0.492]);
  });

  it('would reach the least at its end if the wiki were right', () => {
    const shares = [10, 12.5, 15, 20, 30].map((metres) => shareAt(metres, TIGRIS, ON_THE_WIKI));
    expect(shares.map(round)).toEqual([1, 0.8782, 0.7564, 0.5128, 0.5128]);
  });

  it('is not there without one', () => {
    expect(factorOf(hit({ distance: 1000 }), 'falloff')).toEqual({
      name: 'falloff',
      value: 1,
      effects: [],
    });
  });

  it('lowers all damage alike', () => {
    const near = hit({ attack: { falloff: TIGRIS } });
    const far = hit({ attack: { falloff: TIGRIS }, distance: 12.5 });
    expect(far.total / near.total).toBeCloseTo(0.75, 12);
    for (const [type, damage] of far.perType) {
      expect(damage / (near.perType.get(type) ?? 0)).toBeCloseTo(0.75, 12);
    }
  });

  it('counts in a shot', () => {
    const aim = { head: 0, body: 1 };
    const attack = { falloff: TIGRIS };
    const far = shot({ attack, aim, distance: 25 }).total;
    expect(far / shot({ attack, aim }).total).toBeCloseTo(0.5128, 12);
  });
});

describe('projectile speed', () => {
  it('stretches falloff: +60% makes 10 to 20 m into 16 to 32 m', () => {
    const modules = [speed(0.6)];
    const shares = [16, 20, 32].map((distance) => shareAt(distance, TIGRIS, { modules }));
    expect(shares.map(round)).toEqual([1, 0.75, 0.5128]);
  });

  it('shortens it if it is lower', () => {
    const slowedBy = (value: number) => ({ modules: [speed(value)] });
    expect(shareAt(10, TIGRIS, slowedBy(-0.5))).toBeCloseTo(0.5128, 12);
    expect(shareAt(0, TIGRIS, slowedBy(-1))).toBe(1);
    expect(shareAt(0.1, TIGRIS, slowedBy(-1.5))).toBe(0.5128);
  });

  it('is named behind the factor', () => {
    const result = hit({ attack: { falloff: TIGRIS }, modules: [speed(0.6)] }, BODY);
    const { effects } = factorOf(result, 'falloff');
    expect(effects.map(({ source }) => source.name)).toEqual(['speed']);
  });

  it('changes nothing without falloff', () => {
    expect(factorOf(hit({ modules: [speed(-0.9)], distance: 500 }), 'falloff').value).toBe(1);
  });
});

it('never grows with distance, and stays between the least and all', () => {
  const metres = fc.double({ min: 0, max: 100, noNaN: true });
  fc.assert(
    fc.property(metres, metres, (...[one, other]) => {
      const [near, far] = one < other ? [one, other] : [other, one];
      const [more, less] = [near, far].map((distance) => shareAt(distance, TIGRIS));
      expect(less).toBeLessThanOrEqual(more ?? 0);
      expect(less).toBeGreaterThanOrEqual(0.5128);
      expect(more).toBeLessThanOrEqual(1);
    }),
  );
});
