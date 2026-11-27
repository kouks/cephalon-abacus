import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { Assumptions } from '@/assumptions';
import { buildAttack } from '@/build/buildAttack';
import type { Loadout } from '@/build/loadout';
import { makeLoadout } from '@/build/loadout';
import { EXPECTED_ROLLER } from '@/resolve/roller';
import type { HitTrace, TickTrace } from '@/trace/hitTrace';
import { cycleOf } from '@/timeline/cycle';
import type { EnemyState } from '@/timeline/enemyState';
import { stateOf } from '@/timeline/enemyState';
import { fightUntil } from '@/timeline/fight';
import type { Series } from '@/timeline/series';
import { damageOf, sampleTraces, seriesOf, tickDamageOf } from '@/timeline/series';
import type { Statuses } from '@/timeline/statuses';
import { addStack, NO_STATUSES } from '@/timeline/statuses';
import type { Capped } from '@/timeline/statusRules';
import { statusRuleOf } from '@/timeline/statusRules';
import { strikesOf } from '@/timeline/strikes';

import type { BuildMetrics } from './buildMetrics';
import { buildMetrics } from './buildMetrics';
import { enemyOf } from './enemyOf';
import { enemyStatuses } from './enemyStatuses';

/** A fight over time against one enemy (BIBLE §9). */
export type Simulation = Pick<BuildMetrics, 'attackId' | 'layer' | 'enemy' | 'warnings'> & {
  /** Seconds until the enemy died. Absent: it lived through the fight. */
  readonly timeToKill?: number;
  /** How long the fight lasted: until the enemy died, or the scenario's duration. */
  readonly lasted: number;
  /** What the hits dealt, all told, as `evaluate` counts a shot. */
  readonly direct: number;
  /** What the procs' ticks dealt, all told, each on the enemy as it was then (BIBLE §8). */
  readonly dot: number;
  readonly series: Series;
  /** Hits of the fight, as many as are kept (MOST_TRACES), evenly spread. */
  readonly trace: readonly HitTrace[];
  /** Its ticks, as many as are kept, evenly spread. */
  readonly ticks: readonly TickTrace[];
};

/**
 * The statuses the scenario puts on the enemy, which stay all fight, at no more stacks than it takes
 * (BIBLE §8).
 */
const startingStatuses = (scenario: Scenario, library: Library, enemy: EnemyState): Statuses => {
  const capped = enemyCaps(scenario, library);
  return enemyStatuses(scenario.enemy, library, enemy).stacks.reduce(
    (statuses, [status, amount]) =>
      addStack(
        statuses,
        { status, at: 0, amount, duration: Number.POSITIVE_INFINITY },
        statusRuleOf(status, library, capped),
      ),
    NO_STATUSES,
  );
};

const enemyCaps = ({ enemy }: Scenario, library: Library): Capped => {
  const statusCaps = library.enemies.get(enemy.id)?.statusCaps;
  return statusCaps === undefined ? {} : { statusCaps };
};

const setupOf = (scenario: Scenario, loadout: Loadout, attackId: string) => {
  const { library, weapon } = loadout;
  const attack = must(
    weapon.attacks.find(({ id }) => id === attackId),
    'The metrics name one of its attacks',
  );
  const { target, defence } = enemyOf(scenario.enemy, library);
  const fight = {
    target,
    defence,
    library,
    enemy: enemyCaps(scenario, library),
    roller: EXPECTED_ROLLER,
  };
  const fresh = stateOf(defence.left);
  return {
    cycle: cycleOf(weapon, buildAttack(loadout, attack)),
    strikes: strikesOf(loadout, attack, { target, aim: scenario.aim, distance: scenario.distance }),
    fight,
    enemy: { ...fresh, statuses: startingStatuses(scenario, library, fresh) },
  };
};

/**
 * A build's firing mode against the scenario's enemy, from a full magazine until it dies or the
 * scenario's duration is up, in expected value. Monte Carlo comes with ABA-27.
 */
export const simulation = (
  scenario: Scenario,
  library: Library,
  assumptions: Partial<Assumptions> = {},
): Simulation => {
  const { attackId, layer, enemy, warnings } = buildMetrics(scenario, library, assumptions);
  const loadout = makeLoadout(scenario, library, assumptions);
  const fought = fightUntil(setupOf(scenario, loadout, attackId), scenario.duration);
  const { hits, ticks, diedAt } = fought;
  const lasted = diedAt ?? scenario.duration;
  return {
    attackId,
    layer,
    ...(enemy === undefined ? {} : { enemy }),
    ...(diedAt === undefined ? {} : { timeToKill: diedAt }),
    lasted,
    direct: hits.reduce((sum, hit) => sum + damageOf(hit), 0),
    dot: ticks.reduce((sum, tick) => sum + tickDamageOf(tick), 0),
    series: seriesOf(fought, lasted),
    trace: sampleTraces(hits.map(({ hit }) => hit.trace)),
    ticks: sampleTraces(ticks),
    warnings,
  };
};
