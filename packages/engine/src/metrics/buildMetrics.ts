import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { Assumptions } from '@/assumptions';
import { makeLoadout } from '@/build/loadout';
import type { Warning } from '@/build/types';
import { findTarget } from '@/resolve/target';
import type { HitTrace } from '@/trace/hitTrace';

import type { AttackMetrics, Headline } from './attackMetrics';
import { attackMetrics } from './attackMetrics';
import { checkMetrics } from './checkMetrics';
import { firingModes } from './firingModes';

/** A build's headline numbers, and where they come from. */
export type BuildMetrics = Headline & {
  /** The firing mode the headline is for. */
  readonly attackId: string;
  readonly byAttack: readonly AttackMetrics[];
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
  const { build, enemy, aim } = scenario;
  const loadout = makeLoadout(scenario, library, assumptions);
  const target = findTarget(enemy.id, library);
  const byAttack = firingModes(loadout.weapon).map((attack) =>
    attackMetrics(loadout, attack, { target, aim }),
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
    trace: tracesOf(chosen),
    warnings: [...loadout.collected.warnings, ...checkMetrics(scenario, loadout.weapon, target)],
  };
};
