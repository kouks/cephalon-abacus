import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { Layer } from '@abacus/data/schema/damageTypeRule';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { Assumptions } from '@/assumptions';
import { makeLoadout } from '@/build/loadout';
import type { Warning } from '@/build/types';
import type { EnemyStats } from '@/enemy/scaleEnemy';
import { enemyStats } from '@/enemy/scaleEnemy';
import { roundingOf } from '@/enemy/whole';
import { defenceOf } from '@/resolve/defence';
import { findTarget } from '@/resolve/target';
import type { HitTrace } from '@/trace/hitTrace';

import type { AttackMetrics, Headline } from './attackMetrics';
import { attackMetrics } from './attackMetrics';
import { checkLanding, checkLayer, checkMetrics, checkRange } from './checkMetrics';
import { enemyStatuses } from './enemyStatuses';
import { firingModes } from './firingModes';

/** A build's headline numbers, and where they come from. */
export type BuildMetrics = Headline & {
  /** The firing mode the headline is for. */
  readonly attackId: string;
  readonly byAttack: readonly AttackMetrics[];
  /** The layer the hits meet. */
  readonly layer: Layer;
  /** The enemy at its level. Absent for the neutral dummy, which has no stats. */
  readonly enemy?: EnemyStats;
  /** Every hit of the headline's shot. */
  readonly trace: readonly HitTrace[];
  readonly warnings: readonly Warning[];
};

const tracesOf = ({ shots }: AttackMetrics) =>
  shots.flatMap(({ shot }) => shot.hits.map(({ hit }) => hit.trace));

export const buildMetrics = (
  scenario: Scenario,
  library: Library,
  assumptions: Partial<Assumptions> = {},
): BuildMetrics => {
  const { build, enemy, aim, distance } = scenario;
  const loadout = makeLoadout(scenario, library, assumptions);
  const target = findTarget(enemy.id, library);
  const stats = enemyStats(enemy, library);
  const { layer, left } = enemy;
  const armorRounding = roundingOf('armor', library);
  const defence = defenceOf({ layer, left, stats, rules: library.damageTypes, armorRounding });
  const onEnemy = enemyStatuses(enemy, library, defence);
  const byAttack = firingModes(loadout.weapon).map((attack) =>
    attackMetrics(loadout, attack, { target, defence, aim, distance, taken: onEnemy.taken }),
  );

  const asked = byAttack.find(({ attackId }) => attackId === build.attackId);
  const chosen = asked ?? must(byAttack[0], 'A weapon has a firing mode');
  const { attackId, perShot, burstDps, sustainedDps, lifetimeDamage } = chosen;
  return {
    attackId,
    perShot,
    burstDps,
    sustainedDps,
    lifetimeDamage,
    byAttack,
    layer: defence.layer,
    ...(stats === undefined ? {} : { enemy: stats }),
    trace: tracesOf(chosen),
    warnings: [
      ...loadout.collected.warnings,
      ...checkMetrics(scenario, { weapon: loadout.weapon, target, library }),
      ...checkLayer(defence.layer, stats),
      ...checkRange(byAttack, distance),
      ...checkLanding(byAttack, aim),
      ...onEnemy.warnings,
    ],
  };
};
