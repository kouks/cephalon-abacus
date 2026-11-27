import type { Library } from '@abacus/data/load/library';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { Warning } from '@/build/types';
import type { Defence } from '@/resolve/defence';
import type { Taken } from '@/resolve/taken';
import { takenOfStacks } from '@/timeline/enemyState';
import type { Capped } from '@/timeline/statusRules';
import { statusRuleOf } from '@/timeline/statusRules';

type OnEnemy = {
  /** Each status's stacks, at no more than the enemy takes. */
  readonly stacks: readonly (readonly [string, number])[];
  readonly taken: readonly Taken[];
  readonly warnings: readonly Warning[];
};

/** The most stacks of a status this enemy takes: the status's own, and its caps. */
const mostOf = (status: string, library: Library, enemy: Capped) => {
  const { stacking, cap = Number.POSITIVE_INFINITY } = statusRuleOf(status, library, enemy);
  return Math.min(stacking.kind === 'capped' ? stacking.most : Number.POSITIVE_INFINITY, cap);
};

/**
 * What the statuses the scenario puts on the enemy do to its hits (BIBLE §8), at no more stacks than
 * it takes: under its caps, and Cold's 4 while it has Overguard left.
 */
export const enemyStatuses = (
  { id, statuses = {} }: Scenario['enemy'],
  library: Library,
  { left }: Pick<Defence, 'left'>,
): OnEnemy => {
  const statusCaps = library.enemies.get(id)?.statusCaps;
  const enemy = {
    ...(statusCaps === undefined ? {} : { statusCaps }),
    hasOverguard: left.overguard > 0,
  };
  const entries = Object.entries(statuses);
  const known = entries
    .filter(([status]) => library.statuses.has(status))
    .map(([status, stacks]) => ({ status, stacks, most: mostOf(status, library, enemy) }));
  const warnings: readonly Warning[] = [
    ...entries
      .filter(([status]) => !library.statuses.has(status))
      .map(([status]) => ({ code: 'unknownStatus', status }) as const),
    ...known
      .filter(({ stacks, most }) => stacks > most)
      .map((entry) => ({ code: 'statusAboveMost', ...entry }) as const),
  ];
  const stacks = known.map(({ status, stacks, most }) => [status, Math.min(stacks, most)] as const);
  return { stacks, taken: takenOfStacks(stacks, library), warnings };
};
