import { describe, expect, it } from 'vitest';

import { drawingRoller } from '@/resolve/roller';
import { linesOf, scheduleOf, shotsPerSecond } from '@/testing/schedule';

import type { Cycle } from './cycle';

/** 4 shots a second, 3 to a magazine, 2 s to reload. */
const AUTO: Cycle = {
  charge: 0,
  burst: { count: 1, delay: 0 },
  delay: 0.25,
  magazine: 3,
  reload: 2,
  hidesDelay: false,
};

const lines = (change: Partial<Cycle>, until: number) =>
  linesOf(scheduleOf({ ...AUTO, ...change }, until));

describe('the weapon cycle', () => {
  it('fires every delay, and reloads after the last shot’s delay', () => {
    expect(lines({}, 3.5)).toEqual([
      'fire 0',
      'fire 0.25',
      'fire 0.5',
      'reloadStart 0.75',
      'reloadEnd 2.75',
      'fire 2.75',
      'fire 3',
      'fire 3.25',
    ]);
  });

  it('starts the reload at the last shot where the reload hides its delay', () => {
    expect(lines({ hidesDelay: true }, 3)).toEqual([
      'fire 0',
      'fire 0.25',
      'fire 0.5',
      'reloadStart 0.5',
      'reloadEnd 2.5',
      'fire 2.5',
      'fire 2.75',
    ]);
  });

  it('charges before every shot, the first too', () => {
    expect(lines({ charge: 0.5, delay: 0, magazine: 2, reload: 1 }, 3)).toEqual([
      'fire 0.5',
      'fire 1',
      'reloadStart 1',
      'reloadEnd 2',
      'fire 2.5',
    ]);
  });

  it('fires a burst at its delay, then waits the fire delay', () => {
    const burst = { count: 3, delay: 0.05 };
    expect(lines({ burst, delay: 0.2, magazine: 6 }, 0.8)).toEqual([
      'fire 0',
      'fire 0.05',
      'fire 0.1',
      'fire 0.3',
      'fire 0.35',
      'fire 0.4',
      'reloadStart 0.6',
    ]);
  });

  it('fires the share of a shot a magazine has left, for that share of the time', () => {
    expect(lines({ charge: 0.1, delay: 0.3, magazine: 1.5, reload: 1 }, 2)).toEqual([
      'fire 0.1',
      'fire 0.45 ×0.5',
      'reloadStart 0.6',
      'reloadEnd 1.6',
      'fire 1.7',
    ]);
  });

  it('fires as many shots a second as the closed form says, a share of one included', () => {
    const cycle = { ...AUTO, charge: 0.1, magazine: 7.4, reload: 1.3 };
    const closedForm = 7.4 / (7.4 * (0.1 + 0.25) + 1.3);
    expect(shotsPerSecond(scheduleOf(cycle, 200))).toBeCloseTo(closedForm, 10);
  });

  it('never reloads a magazine that never runs out', () => {
    const events = scheduleOf({ ...AUTO, magazine: Infinity }, 100);
    expect(events).toHaveLength(400);
    expect(events.every(({ kind }) => kind === 'fire')).toBe(true);
  });

  it('draws whole shots: one more with the chance of the share', () => {
    const draws = [0.2, 0.9];
    const roller = drawingRoller(() => draws.shift() ?? 0);
    const events = scheduleOf({ ...AUTO, magazine: 1.5, reload: 1 }, 2.5, roller);
    expect(linesOf(events)).toEqual([
      'fire 0',
      'fire 0.25',
      'reloadStart 0.5',
      'reloadEnd 1.5',
      'fire 1.5',
      'reloadStart 1.75',
    ]);
  });
});
