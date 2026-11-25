import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { BODY, factorOf, hit, shot } from '@/testing/hit';

const TIGRIS = { start: 10, end: 20, minPct: 0.5128 };
const EXERGIS = { start: 30, end: 60, minPct: 0.492 };

const speed = (value: number) => mod('speed', [add('projectileSpeed', value)]);

const shareAt = (distance: number, falloff: object, ...modules: readonly { id: string }[]) =>
  factorOf(hit({ attack: { falloff }, distance, modules }), 'falloff').value;

describe('falloff', () => {
  it.each([
    [0, 1],
    [10, 1],
    [12.5, 0.8782],
    [15, 0.7564],
    [20, 0.5128],
    [30, 0.5128],
  ])('of Tigris Prime at %d m leaves %d', (distance, share) => {
    expect(shareAt(distance, TIGRIS)).toBeCloseTo(share, 12);
  });

  it('exergis deals 100% to 49.2% between 30 and 60 m', () => {
    const shares = [30, 45, 60].map((distance) => shareAt(distance, EXERGIS));
    expect(shares.map((share) => Number(share.toFixed(12)))).toEqual([1, 0.746, 0.492]);
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
    const far = hit({ attack: { falloff: TIGRIS }, distance: 15 });
    expect(far.total / near.total).toBeCloseTo(0.7564, 12);
    for (const [type, damage] of far.perType) {
      expect(damage / (near.perType.get(type) ?? 0)).toBeCloseTo(0.7564, 12);
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
    const shares = [16, 24, 32].map((distance) => shareAt(distance, TIGRIS, speed(0.6)));
    expect(shares.map((share) => Number(share.toFixed(12)))).toEqual([1, 0.7564, 0.5128]);
  });

  it('shortens it if it is lower', () => {
    expect(shareAt(10, TIGRIS, speed(-0.5))).toBeCloseTo(0.5128, 12);
    expect(shareAt(0, TIGRIS, speed(-1))).toBe(1);
    expect(shareAt(0.1, TIGRIS, speed(-1.5))).toBe(0.5128);
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
