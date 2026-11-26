import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { DamageType } from '@abacus/data/schema/damageType';
import type { Enemy } from '@abacus/data/schema/enemy';
import type { Status } from '@abacus/data/schema/status';

import type { StatusRule } from './statuses';

/** The status a type procs, and how its stacks join on this enemy. Absent: it procs none. */
export const statusRuleOf = (
  type: DamageType,
  { damageTypes, statuses }: Pick<Library, 'damageTypes' | 'statuses'>,
  enemy?: Pick<Enemy, 'statusCaps'>,
): (StatusRule & { readonly status: Status }) | undefined => {
  const proc = damageTypes.get(type)?.proc;
  if (proc === undefined) return undefined;
  const status = must(statuses.get(proc), 'The loader checks that every proc has a status');
  const cap = enemy?.statusCaps?.[type];
  return { status, stacking: status.stacking, ...(cap === undefined ? {} : { cap }) };
};
