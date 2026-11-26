import { describe, expect, it } from 'vitest';

import type { Added, Statuses, StatusRule } from './statuses';
import { addStack, expireAt, NO_STATUSES, stacksAt } from './statuses';

const INDEPENDENT: StatusRule = { stacking: { kind: 'independent' } };
const FIVE: StatusRule = { stacking: { kind: 'capped', most: 5 } };
const MERGED: StatusRule = { stacking: { kind: 'merged' } };

type Stacked = Omit<Added, 'status' | 'amount'> & { readonly amount?: number };

/** Stacks of one status, added one after another. */
const stacked = (rule: StatusRule, stacks: readonly Stacked[], status = 'bleed') =>
  stacks.reduce<Statuses>(
    (statuses, { amount = 1, ...stack }) => addStack(statuses, { status, amount, ...stack }, rule),
    NO_STATUSES,
  );

const every = (from: number, to: number, duration: number): readonly Stacked[] =>
  Array.from({ length: to - from + 1 }, (_, index) => ({ at: from + index, duration }));

describe('independent stacks', () => {
  it('each last their own time, with no limit', () => {
    const bleed = stacked(INDEPENDENT, every(0, 11, 6));
    expect(stacksAt(bleed, 'bleed', 5.5)).toBe(6);
    expect(stacksAt(bleed, 'bleed', 11.5)).toBe(6);
    expect(stacksAt(bleed, 'bleed', 17)).toBe(0);
  });

  it('are counted for their own status only', () => {
    expect(stacksAt(stacked(INDEPENDENT, every(0, 2, 6)), 'poison', 1)).toBe(0);
  });
});

describe('capped stacks', () => {
  it('keep the most, and the oldest go past it', () => {
    const weakened = stacked(FIVE, every(0, 6, 10));
    expect(stacksAt(weakened, 'bleed', 6.5)).toBe(5);
    expect(weakened.get('bleed')?.map(({ endsAt }) => endsAt)).toEqual([12, 13, 14, 15, 16]);
  });

  it('replace the oldest, however long it has left (the wiki’s Puncture page)', () => {
    const long = stacked(FIVE, [{ at: 0, duration: 60 }, ...every(1, 5, 10)]);
    expect(long.get('bleed')?.map(({ endsAt }) => endsAt)).toEqual([11, 12, 13, 14, 15]);
  });

  it('take the enemy’s own cap where it is lower: Cold at 4 on bosses', () => {
    const cold: StatusRule = { stacking: { kind: 'capped', most: 10 }, cap: 4 };
    expect(stacksAt(stacked(cold, every(0, 9, 6), 'freeze'), 'freeze', 9.5)).toBe(4);
  });

  it('cap an independent status too, where the enemy has a cap for it', () => {
    const capped = stacked({ ...INDEPENDENT, cap: 3 }, every(0, 5, 6));
    expect(stacksAt(capped, 'bleed', 5.5)).toBe(3);
  });
});

describe('a merged status, as Heat', () => {
  it('makes every stack last as long as the newest, from now', () => {
    const ignite = stacked(MERGED, [
      { at: 0, duration: 6 },
      { at: 4, duration: 6 },
    ]);
    expect(stacksAt(ignite, 'bleed', 9.9)).toBe(2);
    expect(stacksAt(ignite, 'bleed', 10)).toBe(0);
  });

  it('keeps the longest duration among its stacks, from any source', () => {
    const ignite = stacked(MERGED, [
      { at: 0, duration: 9 },
      { at: 2, duration: 6 },
    ]);
    expect(ignite.get('bleed')?.map(({ endsAt }) => endsAt)).toEqual([11, 11]);
  });

  it('lets stacks that ended go before the next joins', () => {
    const ignite = stacked(MERGED, [
      { at: 0, duration: 6 },
      { at: 7, duration: 6 },
    ]);
    expect(stacksAt(ignite, 'bleed', 8)).toBe(1);
  });
});

describe('expected value', () => {
  it('counts shares of stacks', () => {
    const shares = stacked(INDEPENDENT, [
      { at: 0, duration: 6, amount: 0.25 },
      { at: 1, duration: 6, amount: 0.5 },
    ]);
    expect(stacksAt(shares, 'bleed', 2)).toBeCloseTo(0.75, 12);
  });

  it('takes a share of the oldest past the most', () => {
    const shares = stacked({ stacking: { kind: 'capped', most: 1 } }, [
      { at: 0, duration: 6, amount: 0.75 },
      { at: 1, duration: 6, amount: 0.5 },
    ]);
    expect(shares.get('bleed')?.map(({ amount }) => amount)).toEqual([0.5, 0.5]);
    expect(stacksAt(shares, 'bleed', 2)).toBe(1);
  });
});

it('drops what has ended, and the types left with nothing', () => {
  const both = addStack(
    stacked(INDEPENDENT, every(0, 2, 6)),
    {
      status: 'poison',
      at: 3,
      amount: 1,
      duration: 1,
    },
    INDEPENDENT,
  );
  const later = expireAt(both, 6.5);
  expect([...later.keys()]).toEqual(['bleed']);
  expect(later.get('bleed')?.map(({ endsAt }) => endsAt)).toEqual([7, 8]);
});
