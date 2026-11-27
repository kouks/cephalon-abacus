import type { TimelineEvent } from './events';
import { RANK } from './events';

type Queued = { readonly event: TimelineEvent; readonly order: number };

/** The events still to come, soonest first, and how many have been added (BIBLE §9). */
export type Queue = { readonly pending: readonly Queued[]; readonly added: number };

export const EMPTY_QUEUE: Queue = { pending: [], added: 0 };

/** By time, then by the kinds' fixed order, then first added first: ties go the same way each time. */
const compare = (a: Queued, b: Queued) =>
  a.event.at - b.event.at || RANK[a.event.kind] - RANK[b.event.kind] || a.order - b.order;

/** Where an entry goes: after every entry that comes before it. No two compare equal, by their order. */
const placeOf = (pending: readonly Queued[], entry: Queued) => {
  let low = 0;
  let high = pending.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const there = pending[middle];
    if (there !== undefined && compare(there, entry) < 0) low = middle + 1;
    else high = middle;
  }
  return low;
};

const enqueueOne = ({ pending, added }: Queue, event: TimelineEvent): Queue => {
  const entry = { event, order: added };
  const place = placeOf(pending, entry);
  return {
    pending: [...pending.slice(0, place), entry, ...pending.slice(place)],
    added: added + 1,
  };
};

/** The queue with some more events, each in its place. */
export const enqueue = (queue: Queue, events: readonly TimelineEvent[]): Queue =>
  events.reduce(enqueueOne, queue);

/** The soonest event, if there is one, and the queue without it. */
export const dequeue = ({ pending, added }: Queue) => ({
  event: pending[0]?.event,
  rest: { pending: pending.slice(1), added },
});
