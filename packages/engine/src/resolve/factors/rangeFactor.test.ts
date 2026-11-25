import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { factorOf, hit, shot } from '@/testing/hit';

const AMPREX = { range: 18 };

const REACH = mod('sinister-reach', [add('range', 12, { op: 'ADD' })]);

const at = (distance: number, setup: Parameters<typeof hit>[0] = {}) =>
  hit({ attack: AMPREX, distance, ...setup });

const shareAt = (...args: Parameters<typeof at>) => factorOf(at(...args), 'range').value;

describe('range', () => {
  it.each([
    [0, 1],
    [17.9, 1],
    [18, 1],
    [18.001, 0],
    [30, 0],
  ])('of Amprex, 18 m, at %d m leaves %d', (distance, share) => {
    expect(shareAt(distance)).toBe(share);
  });

  it('leaves nothing beyond it: of any type, in any tier', () => {
    const { total, perType, tiers } = at(19);
    expect(total).toBe(0);
    expect([...perType.values()]).toEqual([0, 0, 0]);
    expect(tiers.map((tier) => tier.total)).toEqual([0, 0]);
  });

  it('is not there without one: most projectiles always reach', () => {
    const { value, effects } = factorOf(hit({ attack: {}, distance: 1000 }), 'range');
    expect([value, effects]).toEqual([1, []]);
  });

  it('counts in a shot', () => {
    const aim = { head: 0, body: 1 };
    expect(shot({ attack: AMPREX, aim, distance: 18 }).total).toBeGreaterThan(0);
    expect(shot({ attack: AMPREX, aim, distance: 19 }).total).toBe(0);
  });
});

describe('a range bonus', () => {
  it('adds metres: Sinister Reach makes 18 m into 30 m', () => {
    const modules = [REACH];
    expect([30, 30.001].map((distance) => shareAt(distance, { modules }))).toEqual([1, 0]);
  });

  it('is named behind the factor', () => {
    const { effects } = factorOf(at(25, { modules: [REACH] }), 'range');
    expect(effects.map(({ source, value }) => [source.name, value])).toEqual([
      ['sinister-reach', 12],
    ]);
  });
});

describe('projectile speed', () => {
  const PLASMOR = { range: 30, shotType: 'projectile', projectileSpeed: 60 };
  const modules = [mod('fatal-acceleration', [add('projectileSpeed', 0.4)])];

  const reached = (attack: object, setup: Parameters<typeof hit>[0] = {}) =>
    [18, 19, 30, 31, 42, 43].filter((distance) => at(distance, { attack, ...setup }).total > 0);

  it('takes a projectile further: Arca Plasmor’s 30 m are 42 m with Fatal Acceleration', () => {
    expect(reached(PLASMOR)).toEqual([18, 19, 30]);
    expect(reached(PLASMOR, { modules })).toEqual([18, 19, 30, 31, 42]);
  });

  it('is named behind the factor', () => {
    const { effects } = factorOf(at(40, { attack: PLASMOR, modules }), 'range');
    expect(effects.map(({ source }) => source.name)).toEqual(['fatal-acceleration']);
  });

  it('stretches its falloff too, and leaves the range of other shots alone', () => {
    const falloff = { start: 10, end: 20, minPct: 0.3333 };
    const near = at(14, { attack: { ...PLASMOR, falloff }, modules });
    expect(factorOf(near, 'falloff').value).toBe(1);
    expect(reached(AMPREX, { modules })).toEqual([18]);
    expect(factorOf(at(18, { modules }), 'range').effects).toEqual([]);
  });
});

it('changes no damage up to it, and leaves none beyond', () => {
  const metres = fc.double({ min: 0.1, max: 500, noNaN: true });
  const { total } = hit({ attack: {} });
  fc.assert(
    fc.property(metres, metres, (...[range, distance]) => {
      const found = hit({ attack: { range }, distance }).total;
      expect(found).toBe(distance <= range ? total : 0);
    }),
  );
});
