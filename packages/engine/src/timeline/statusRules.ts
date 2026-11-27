import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { Enemy } from '@abacus/data/schema/enemy';
import type { Status } from '@abacus/data/schema/status';

import type { StatusRule } from './statuses';

/** What of the enemy decides its caps: its own, and whether it has Overguard left. */
export type Capped = Pick<Partial<Enemy>, 'statusCaps'> & { readonly hasOverguard?: boolean };

/** The enemy's own cap on a status: statusCaps names the damage type that procs it. */
const enemyCapOf = (
  id: string,
  { damageTypes }: Pick<Library, 'damageTypes'>,
  { statusCaps = {} }: Capped,
) =>
  Object.entries(statusCaps)
    .filter(([type]) =>
      [...damageTypes.values()].some((rule) => rule.id === type && rule.proc === id),
    )
    .map(([, cap]) => cap);

/**
 * A status, and how its stacks join on this enemy: under its own caps, and under the status's cap
 * while the enemy has Overguard left (Cold's 4, the wiki's Cold page).
 */
export const statusRuleOf = (
  id: string,
  library: Pick<Library, 'damageTypes' | 'statuses'>,
  enemy: Capped = {},
): StatusRule & { readonly status: Status } => {
  const status = must(library.statuses.get(id), `No status "${id}"`);
  const overguard =
    enemy.hasOverguard === true ? [status.overguardMost ?? Number.POSITIVE_INFINITY] : [];
  const caps = [...enemyCapOf(id, library, enemy), ...overguard];
  const cap = caps.length === 0 ? undefined : Math.min(...caps);
  return {
    status,
    stacking: status.stacking,
    ...(cap === undefined || cap === Number.POSITIVE_INFINITY ? {} : { cap }),
  };
};
