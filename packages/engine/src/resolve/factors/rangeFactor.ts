import type { ModdedStat } from '@/build/stats/moddedStat';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

/** An attack without a range always reaches: a projectile, an explosion. */
export const isInRange = (range: ModdedStat | undefined, distance: number): boolean =>
  range === undefined || distance <= range.value;

/** All or nothing: beyond its range an attack doesn't hit (BIBLE §11). */
export const rangeFactor = (range: ModdedStat | undefined, distance: number): Factor =>
  factor('range', isInRange(range, distance) ? 1 : 0, effectsOf(range?.totals ?? []));
