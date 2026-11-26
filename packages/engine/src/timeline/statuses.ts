import type { DamageType } from '@abacus/data/schema/damageType';
import type { Stacking } from '@abacus/data/schema/status';

/**
 * One stack of a status: how much of it there is (1, or a share in expected value), how long it lasts,
 * and when it ends, in simulated seconds.
 */
export type Stack = { readonly amount: number; readonly duration: number; readonly endsAt: number };

/** An enemy's statuses: the stacks of each damage type's, oldest first (BIBLE §8). */
export type Statuses = ReadonlyMap<DamageType, readonly Stack[]>;

/** How a status's stacks join, and the enemy's own cap on them, if it has one. */
export type StatusRule = { readonly stacking: Stacking; readonly cap?: number };

/** A new stack: whose status, when it lands, how much of it, and how long it lasts. */
export type Added = {
  readonly type: DamageType;
  readonly at: number;
  readonly amount: number;
  /** In seconds, with status duration bonuses. */
  readonly duration: number;
};

export const NO_STATUSES: Statuses = new Map();

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

const liveAt = (stacks: readonly Stack[], at: number) => stacks.filter(({ endsAt }) => endsAt > at);

/** How many stacks of a type's status are live at a time: a share in expected value. */
export const stacksAt = (statuses: Statuses, type: DamageType, at: number): number =>
  sum(liveAt(statuses.get(type) ?? [], at).map(({ amount }) => amount));

const mostOf = ({ stacking, cap = Number.POSITIVE_INFINITY }: StatusRule) =>
  Math.min(stacking.kind === 'capped' ? stacking.most : Number.POSITIVE_INFINITY, cap);

/** The newest stacks up to the most: the oldest go first, however long they have left. */
const keepNewest = (stacks: readonly Stack[], most: number): readonly Stack[] => {
  let excess = sum(stacks.map(({ amount }) => amount)) - most;
  return stacks.flatMap((stack) => {
    if (excess <= 0) return [stack];
    const cut = Math.min(stack.amount, excess);
    excess -= cut;
    return stack.amount > cut ? [{ ...stack, amount: stack.amount - cut }] : [];
  });
};

/** Heat: every stack lasts the longest duration among them, from now. */
const refreshed = (stacks: readonly Stack[], at: number): readonly Stack[] => {
  const longest = Math.max(...stacks.map(({ duration }) => duration));
  return stacks.map((stack) => ({ ...stack, endsAt: at + longest }));
};

/** A new stack, joined to the live ones as its status's stacking says (BIBLE §8). */
export const addStack = (
  statuses: Statuses,
  { type, at, amount, duration }: Added,
  rule: StatusRule,
): Statuses => {
  const live = liveAt(statuses.get(type) ?? [], at);
  const stacks = [...live, { amount, duration, endsAt: at + duration }];
  const joined = rule.stacking.kind === 'merged' ? refreshed(stacks, at) : stacks;
  return new Map([...statuses, [type, keepNewest(joined, mostOf(rule))]]);
};

/** The statuses without the stacks that have ended by a time. */
export const expireAt = (statuses: Statuses, at: number): Statuses =>
  new Map(
    [...statuses]
      .map(([type, stacks]) => [type, liveAt(stacks, at)] as const)
      .filter(([, stacks]) => stacks.length > 0),
  );
