import type { Library } from '@abacus/data/load/library';
import type { Status, StatusEffect } from '@abacus/data/schema/status';

import type { LayersLeft } from '@/resolve/applyHit';
import type { Taken } from '@/resolve/taken';

import type { Statuses } from './statuses';
import { NO_STATUSES, stacksAt } from './statuses';

/**
 * One enemy as the hits find it: when, what is left of each layer, and the statuses on it, which
 * every hit reads and writes (BIBLE §3).
 */
export type EnemyState = {
  readonly at: number;
  readonly left: LayersLeft;
  readonly statuses: Statuses;
};

/** The enemy as the scenario has it, with no statuses yet. */
export const stateOf = (left: LayersLeft, at = 0): EnemyState => ({
  at,
  left,
  statuses: NO_STATUSES,
});

/** `first` for one stack and `more` for each after it; below one, a share of the first. */
const linearAt = ({ first, more }: StatusEffect, stacks: number): number =>
  stacks <= 1 ? first * Math.max(stacks, 0) : first + more * (stacks - 1);

/**
 * How strong a status's effect is at a number of stacks (BIBLE §8). One that is worth `atMost` at the
 * status's most stacks (Cold's Frozen) heads for it from one stack below; in expected value, stacks
 * are shares.
 */
export const strengthAt = (effect: StatusEffect, stacks: number, most?: number): number => {
  const { atMost } = effect;
  if (atMost === undefined || most === undefined || stacks <= most - 1) {
    return linearAt(effect, stacks);
  }
  const below = linearAt(effect, most - 1);
  return below + (atMost - below) * Math.min(stacks - (most - 1), 1);
};

const mostOf = ({ stacking }: Status) => (stacking.kind === 'capped' ? stacking.most : undefined);

const takenOf = (status: Status, stacks: number) =>
  (status.effects ?? []).map(({ bucket, op, scope, ...effect }): Taken => ({
    source: { id: status.id, name: status.name },
    bucket,
    op,
    value: strengthAt({ bucket, op, ...effect }, stacks, mostOf(status)),
    ...(scope === undefined ? {} : { scope }),
  }));

/** What statuses do to the hits that meet the enemy, by their stacks (BIBLE §8). */
export const takenOfStacks = (
  stacks: Iterable<readonly [string, number]>,
  library: Pick<Library, 'statuses'>,
): readonly Taken[] =>
  [...stacks].flatMap(([id, count]) => {
    const status = library.statuses.get(id);
    return status === undefined || count <= 0 ? [] : takenOf(status, count);
  });

/** What the statuses on the enemy do to the hits that meet it, at the state's time. */
export const takenFrom = (
  { statuses, at }: EnemyState,
  library: Pick<Library, 'statuses'>,
): readonly Taken[] =>
  takenOfStacks(
    [...statuses.keys()].map((id) => [id, stacksAt(statuses, id, at)] as const),
    library,
  );
