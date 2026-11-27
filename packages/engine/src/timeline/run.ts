import type { TimelineEvent } from './events';
import type { Queue } from './queue';
import { dequeue, EMPTY_QUEUE, enqueue } from './queue';

/** What an event does: the state after it, the events it brings about, and whether the run ends. */
export type Handler<State> = (
  state: State,
  event: TimelineEvent,
) => {
  readonly state: State;
  readonly next: readonly TimelineEvent[];
  readonly isOver?: boolean;
};

type Start<State> = { readonly state: State; readonly events: readonly TimelineEvent[] };

/**
 * Every event before a time, soonest first, each handled against the state the ones before it left
 * (BIBLE §9). An event at that time or later doesn't happen, nor one after an event that ends the run.
 */
export const runUntil = <State>(start: Start<State>, handle: Handler<State>, until: number) => {
  let { state } = start;
  let queue: Queue = enqueue(EMPTY_QUEUE, start.events);
  for (;;) {
    const { event, rest } = dequeue(queue);
    if (event === undefined || event.at >= until) return state;
    const handled = handle(state, event);
    if (handled.isOver === true) return handled.state;
    state = handled.state;
    queue = enqueue(rest, handled.next);
  }
};
