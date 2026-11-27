import type { ModdedStat } from '@/build/stats/moddedStat';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

/** An attack without a range always reaches: most projectiles, and explosions. */
export const isInRange = (range: ModdedStat | undefined, distance: number): boolean =>
  range === undefined || distance <= range.value;

/** What decides whether a hit gets to the target at all: its range, and where an explosion lands. */
const REACH: ReadonlySet<string> = new Set(['range', 'landing']);

/** Whether a hit gets to the target. One that doesn't deals nothing and inflicts no status. */
export const reachesTarget = (chain: readonly Factor[]): boolean =>
  chain.every(({ name, value }) => !REACH.has(name) || value > 0);

/** All or nothing: beyond its range an attack doesn't hit (BIBLE §11). */
export const rangeFactor = (range: ModdedStat | undefined, distance: number): Factor =>
  factor('range', isInRange(range, distance) ? 1 : 0, effectsOf(range?.totals ?? []));
