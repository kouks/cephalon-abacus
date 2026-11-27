import type { Library } from '@abacus/data/load/library';
import type { StatusEffect } from '@abacus/data/schema/status';

import type { LayersLeft } from '@/resolve/applyHit';

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

/**
 * How strong a status is at a number of stacks: `first` for one, and `more` for each after it. In
 * expected value, less than one stack is that share of the first.
 */
export const strengthAt = ({ first, more }: StatusEffect, stacks: number): number =>
  stacks <= 1 ? first * Math.max(stacks, 0) : first + more * (stacks - 1);

/** What the statuses on the enemy add to one thing it takes, at the state's time. */
export const takenAt = (
  { statuses, at }: EnemyState,
  on: StatusEffect['on'],
  library: Pick<Library, 'statuses'>,
): number =>
  [...statuses.keys()].reduce((sum, id) => {
    const effect = library.statuses.get(id)?.effect;
    return effect?.on === on ? sum + strengthAt(effect, stacksAt(statuses, id, at)) : sum;
  }, 0);
