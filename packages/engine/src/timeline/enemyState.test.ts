import { describe, expect, it } from 'vitest';

import { makeLibrary } from '@/testing/build';

import { stateOf, strengthAt, takenFrom, takenOfStacks } from './enemyState';
import { addStack } from './statuses';

const library = makeLibrary([]);
const TAU = { bucket: 'enemy.status', op: 'STACKING_MULTIPLY', first: 0.1, more: 0.1 } as const;
const COLD = {
  ...TAU,
  bucket: 'crit.damageFlat',
  op: 'ADD',
  first: 0.1,
  more: 0.05,
  atMost: 1,
} as const;
const CAPPED = { stacking: { kind: 'capped', most: 10 } } as const;

describe('a status’s strength', () => {
  it('is the first for one stack, and more for each after it', () => {
    expect([0, 1, 3, 10].map((stacks) => strengthAt(TAU, stacks))).toEqual([
      0,
      0.1,
      expect.closeTo(0.3, 12),
      expect.closeTo(1, 12),
    ]);
    const viral = { ...TAU, first: 1, more: 0.25 };
    expect(strengthAt(viral, 10)).toBe(3.25);
  });

  it('is a share of the first below one stack, in expected value', () => {
    expect(strengthAt(TAU, 0.5)).toBeCloseTo(0.05, 12);
    expect(strengthAt(TAU, -1)).toBe(0);
  });

  it('is what it is worth at the most, once there: a frozen enemy takes +1.0 crit damage', () => {
    expect([1, 9, 10].map((stacks) => strengthAt(COLD, stacks, 10))).toEqual([
      0.1,
      expect.closeTo(0.5, 12),
      1,
    ]);
  });

  it('is never more than it is worth at the most', () => {
    expect(strengthAt(COLD, 12, 10)).toBe(1);
  });

  it('heads for it from one stack below the most, in expected value', () => {
    expect(strengthAt(COLD, 9.5, 10)).toBeCloseTo(0.75, 12);
    expect(strengthAt(COLD, 8.5, 10)).toBeCloseTo(0.475, 12);
  });

  it('runs on as it does without a most, or without a value there', () => {
    expect(strengthAt(COLD, 10)).toBeCloseTo(0.55, 12);
    expect(strengthAt(TAU, 10, 10)).toBeCloseTo(1, 12);
  });
});

describe('what the statuses on an enemy do to the hits', () => {
  const fresh = stateOf({ overguard: 0, shield: 0, health: 100 }, 2);
  const withStacks = (status: string, amount: number, duration = 8) => ({
    ...fresh,
    statuses: addStack(fresh.statuses, { status, at: 0, amount, duration }, CAPPED),
  });

  it('is nothing on a fresh enemy', () => {
    expect(fresh).toEqual({
      at: 2,
      left: { overguard: 0, shield: 0, health: 100 },
      statuses: new Map(),
    });
    expect(takenFrom(fresh, library)).toEqual([]);
  });

  it('is each effect of each status, at its strength at the state’s time', () => {
    const [taken, ...more] = takenFrom(withStacks('status-vulnerability', 3), library);
    expect(more).toEqual([]);
    expect(taken).toEqual({
      source: { id: 'status-vulnerability', name: 'status-vulnerability' },
      bucket: 'enemy.status',
      op: 'STACKING_MULTIPLY',
      value: taken?.value,
    });
    expect(taken?.value).toBeCloseTo(0.3, 12);
    expect(takenFrom(withStacks('status-vulnerability', 3, 1), library)).toEqual([]);
  });

  it('carries the hits an effect reaches', () => {
    expect(takenFrom(withStacks('freeze', 10), library)).toMatchObject([
      { bucket: 'crit.damageFlat', value: 1, scope: ['direct'] },
    ]);
  });

  it('leaves out statuses that do nothing to hits, and those the library lacks', () => {
    expect(takenFrom(withStacks('bleed', 3), library)).toEqual([]);
    expect(takenOfStacks([['brand-new', 3]], library)).toEqual([]);
    expect(takenOfStacks([['virus', 0]], library)).toEqual([]);
  });
});
