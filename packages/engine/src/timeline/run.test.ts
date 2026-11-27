import { describe, expect, it } from 'vitest';

import type { TimelineEvent } from './events';
import type { Handler } from './run';
import { runUntil } from './run';

const fire = (at: number): TimelineEvent => ({ kind: 'fire', at, weight: 1 });

/** Writes down each event, and has each shot bring about another a second later. */
const everySecond: Handler<readonly string[]> = (seen, event) => ({
  state: [...seen, `${event.kind} ${event.at}`],
  next: event.kind === 'fire' ? [fire(event.at + 1)] : [],
});

describe('running the events', () => {
  it('handles each before the time, those it brings about too', () => {
    const seen = runUntil({ state: [], events: [fire(0)] }, everySecond, 3.5);
    expect(seen).toEqual(['fire 0', 'fire 1', 'fire 2', 'fire 3']);
  });

  it('leaves out an event at the very time it stops', () => {
    expect(runUntil({ state: [], events: [fire(0)] }, everySecond, 3)).toHaveLength(3);
  });

  it('puts the events brought about among those already waiting', () => {
    const start = { state: [], events: [fire(0), { kind: 'reloadStart', at: 1.5 } as const] };
    expect(runUntil(start, everySecond, 2.5)).toEqual([
      'fire 0',
      'fire 1',
      'reloadStart 1.5',
      'fire 2',
    ]);
  });

  it('ends when no event is left', () => {
    const once: Handler<number> = (count) => ({ state: count + 1, next: [] });
    expect(runUntil({ state: 0, events: [fire(0), fire(1)] }, once, Infinity)).toBe(2);
  });
});
