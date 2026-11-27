/** A firing mode's cycle on its own: the shots and reloads it makes before a time. */
import type { Roller } from '@/resolve/roller';
import { EXPECTED_ROLLER } from '@/resolve/roller';
import type { Cycle } from '@/timeline/cycle';
import type { TimelineEvent } from '@/timeline/events';
import type { Handler } from '@/timeline/run';
import { runUntil } from '@/timeline/run';
import type { CycleState } from '@/timeline/weaponCycle';
import { advance, loaded } from '@/timeline/weaponCycle';

export const scheduleOf = (
  cycle: Cycle,
  until: number,
  roller: Roller = EXPECTED_ROLLER,
): readonly TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  const handle: Handler<CycleState> = (state, event) => {
    events.push(event);
    return advance(cycle, { state, event }, roller);
  };
  const start = loaded(cycle, 0, roller);
  runUntil({ state: start.state, events: start.next }, handle, until);
  return events;
};

/** What happens when, one line each: "fire 0.5", or "fire 0.5 ×0.25" for a share of a shot. */
export const linesOf = (events: readonly TimelineEvent[], digits = 4): readonly string[] =>
  events.map((event) => {
    const at = `${event.kind} ${Number(event.at.toFixed(digits))}`;
    return event.kind === 'fire' && event.weight !== 1 ? `${at} ×${event.weight}` : at;
  });

/** Shots per second over whole cycles: the shots fired before the last reload ends, by its time. */
export const shotsPerSecond = (events: readonly TimelineEvent[]): number => {
  const ends = events.filter(({ kind }) => kind === 'reloadEnd');
  const last = ends.at(-1)?.at ?? Number.NaN;
  const shots = events
    .filter((event) => event.at < last)
    .reduce((sum, event) => sum + (event.kind === 'fire' ? event.weight : 0), 0);
  return shots / last;
};
