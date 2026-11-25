import type { BuiltAttack } from '@/build/buildAttack';
import type { AttackStats } from '@/build/stats/attackStats';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

/** How far from where it lands an attack deals damage: an explosion its radius, others nowhere. */
export const blastRadius = ({ aoeRadius }: AttackStats): number =>
  Math.max(aoeRadius?.value ?? 0, 0);

/** All or nothing: a shot hits nothing beside it, and an explosion nothing beyond its radius (BIBLE §11). */
export const landingFactor = ({ stats }: BuiltAttack, missBy: number): Factor =>
  factor('landing', missBy <= blastRadius(stats) ? 1 : 0, effectsOf(stats.aoeRadius?.totals ?? []));
