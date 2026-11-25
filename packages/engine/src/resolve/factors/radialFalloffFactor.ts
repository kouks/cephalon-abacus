import type { Attack } from '@abacus/data/schema/attack';

import type { BuiltAttack } from '@/build/buildAttack';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';
import { blastRadius } from './landingFactor';

type Aoe = NonNullable<Attack['aoe']>;

/** `way` is 0 at the centre and 1 at the radius. The falloff is a power, so 0% is even all over. */
const shareAt = (way: number, { centerPct, edgePct }: Aoe) =>
  centerPct * (1 - way) ** (1 - edgePct / centerPct);

/** What is left of an explosion's damage away from its centre. A wider radius stretches it (BIBLE §11). */
export const radialFalloffFactor = (
  { attack: { aoe }, stats }: BuiltAttack,
  missBy: number,
): Factor => {
  if (aoe === undefined) return factor('radialFalloff', 1);
  const way = missBy === 0 ? 0 : Math.min(missBy / blastRadius(stats), 1);
  return factor('radialFalloff', shareAt(way, aoe), effectsOf(stats.aoeRadius?.totals ?? []));
};
