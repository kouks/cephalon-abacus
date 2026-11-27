import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { TimelineEvent } from './events';
import { RANK } from './events';
import type { Queue } from './queue';
import { dequeue, EMPTY_QUEUE, enqueue } from './queue';

const fire = (at: number, weight = 1): TimelineEvent => ({ kind: 'fire', at, weight });
const reloadStart = (at: number): TimelineEvent => ({ kind: 'reloadStart', at });
const reloadEnd = (at: number): TimelineEvent => ({ kind: 'reloadEnd', at });

/** Every event, in the order the queue gives them. */
const drain = (queue: Queue): readonly TimelineEvent[] => {
  const { event, rest } = dequeue(queue);
  return event === undefined ? [] : [event, ...drain(rest)];
};

const inOrder = (events: readonly TimelineEvent[]) => drain(enqueue(EMPTY_QUEUE, events));

/** A stable sort by time and kind, which keeps events that tie in the order they came in. */
const stablySorted = (events: readonly TimelineEvent[]) =>
  events.toSorted((a, b) => a.at - b.at || RANK[a.kind] - RANK[b.kind]);

describe('the event queue', () => {
  it('gives the soonest event first', () => {
    expect(inOrder([fire(2), fire(0.5), fire(1)]).map(({ at }) => at)).toEqual([0.5, 1, 2]);
  });

  it('gives events at the same time in the order of their kinds', () => {
    const kinds = inOrder([reloadStart(1), fire(1), reloadEnd(1)]).map(({ kind }) => kind);
    expect(kinds).toEqual(['reloadEnd', 'fire', 'reloadStart']);
  });

  it('gives events of one kind at the same time first added first', () => {
    const later = enqueue(enqueue(EMPTY_QUEUE, [fire(1, 0.25)]), [fire(1, 0.5), fire(0)]);
    expect(drain(later)).toEqual([fire(0), fire(1, 0.25), fire(1, 0.5)]);
  });

  it('has nothing to give when empty, and stays empty', () => {
    expect(dequeue(EMPTY_QUEUE)).toEqual({ event: undefined, rest: EMPTY_QUEUE });
  });

  it('leaves the queue it was given as it was', () => {
    const queue = enqueue(EMPTY_QUEUE, [fire(1)]);
    enqueue(queue, [fire(0)]);
    dequeue(queue);
    expect(drain(queue)).toEqual([fire(1)]);
  });

  const kinds = fc.constantFrom<TimelineEvent['kind']>('fire', 'reloadStart', 'reloadEnd');
  const events = fc.array(
    fc.record({ kind: kinds, at: fc.integer({ min: 0, max: 5 }), weight: fc.constant(1) }),
  );

  it('gives any events sorted by time, then kind, then the order they came in', () => {
    fc.assert(
      fc.property(events, (added) => {
        expect(inOrder(added)).toEqual(stablySorted(added));
      }),
    );
  });
});
