import { assertNever } from '@abacus/data/assert';

import type { Roller } from '@/resolve/roller';

import type { Cycle } from './cycle';
import type { TimelineEvent } from './events';

/** Where a firing mode is in its cycle: the shots left in the magazine, and those of the burst fired. */
export type CycleState = { readonly left: number; readonly fired: number };

type Next = { readonly state: CycleState; readonly next: readonly TimelineEvent[] };

type Fire = Extract<TimelineEvent, { kind: 'fire' }>;

/**
 * The next shot, after its charge. The last of a magazine can be a share of one in expected value,
 * and it takes that share of the time (BIBLE §9).
 */
const shotFrom = (cycle: Cycle, from: number, left: number): Fire => {
  const weight = Math.min(left, 1);
  return { kind: 'fire', at: from + weight * cycle.charge, weight };
};

/** A full magazine at a time: as many shots as it holds, a chance of one more for a share of one. */
export const loaded = (cycle: Cycle, at: number, roller: Roller): Next => {
  const left = roller.count(cycle.magazine);
  return { state: { left, fired: 0 }, next: [shotFrom(cycle, at, left)] };
};

const afterShot = (cycle: Cycle, { at, weight }: Fire, state: CycleState): Next => {
  const left = state.left - weight;
  const fired = state.fired + 1;
  const inBurst = fired < cycle.burst.count;
  const wait = weight * (inBurst ? cycle.burst.delay : cycle.delay);
  if (left <= 0) {
    const reloadAt = at + (cycle.hidesDelay ? 0 : wait);
    return { state: { left: 0, fired: 0 }, next: [{ kind: 'reloadStart', at: reloadAt }] };
  }
  return {
    state: { left, fired: inBurst ? fired : 0 },
    next: [shotFrom(cycle, at + wait, left)],
  };
};

/** What the cycle does next, after one of its events (BIBLE §9). */
export const advance = (
  cycle: Cycle,
  { state, event }: { readonly state: CycleState; readonly event: TimelineEvent },
  roller: Roller,
): Next => {
  switch (event.kind) {
    case 'fire':
      return afterShot(cycle, event, state);
    case 'reloadStart':
      return { state, next: [{ kind: 'reloadEnd', at: event.at + cycle.reload }] };
    case 'reloadEnd':
      return loaded(cycle, event.at, roller);
    default:
      return assertNever(event);
  }
};
