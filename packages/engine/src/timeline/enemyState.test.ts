import { describe, expect, it } from 'vitest';

import { makeLibrary } from '@/testing/build';

import { stateOf, strengthAt, takenAt } from './enemyState';
import { addStack } from './statuses';

const library = makeLibrary([]);
const TAU = { on: 'statusChanceTaken', first: 0.1, more: 0.1 } as const;
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
});

describe('what the statuses on an enemy add', () => {
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
    expect(takenAt(fresh, 'statusChanceTaken', library)).toBe(0);
  });

  it('is the strength of each status that changes it, at the state’s time', () => {
    expect(
      takenAt(withStacks('status-vulnerability', 3), 'statusChanceTaken', library),
    ).toBeCloseTo(0.3, 12);
    expect(takenAt(withStacks('status-vulnerability', 3, 1), 'statusChanceTaken', library)).toBe(0);
  });

  it('leaves out statuses that change something else', () => {
    expect(takenAt(withStacks('virus', 3), 'statusChanceTaken', library)).toBe(0);
  });
});
