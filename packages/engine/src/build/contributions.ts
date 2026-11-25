import type { Trigger } from '@abacus/data/schema/condition';
import type { Variable } from '@abacus/data/schema/effect';

import { conditionalKey, switchOf } from './conditionals';
import type { Collected, CollectedEffect, Conditional, Contribution } from './types';

/** What effects scale with, besides stacks. */
export type Variables = Readonly<Record<Exclude<Variable, 'stack'>, number>>;

/** No statuses on the target, no combo, and abilities at 100% strength. */
export const NO_VARIABLES: Variables = { statusType: 0, comboTier: 0, abilityStrength: 1 };

/** Stacks by conditional key. */
export type Stacks = ReadonlyMap<string, number>;

/** The stacks the build's switches start it with. */
export const startingStacks = ({ conditionals }: Collected): Stacks =>
  new Map(conditionals.map(({ key, stacks }) => [key, stacks]));

export type Moment = { readonly stacks: Stacks; readonly variables: Variables };

const valueOf = ({ value, times }: CollectedEffect, stacks: number, variables: Variables) =>
  times.reduce(
    (product, name) => (name === 'stack' ? product : product * variables[name]),
    value * stacks,
  );

const contribute = (
  effect: CollectedEffect,
  conditionals: ReadonlyMap<string, Conditional>,
  { stacks, variables }: Moment,
): Contribution => {
  const { source, bucket, op } = effect;
  const condition = switchOf(effect);
  if (condition === undefined) {
    return { source, bucket, op, value: valueOf(effect, 1, variables) };
  }
  const { trigger, requires = [] } = condition;
  const stacksOn = (name: Trigger) => stacks.get(conditionalKey(source.id, name)) ?? 0;
  const key = conditionalKey(source.id, trigger);
  const count = requires.every((name) => stacksOn(name) > 0) ? stacksOn(trigger) : 0;
  const maxStacks = conditionals.get(key)?.maxStacks ?? count;
  const conditional = { trigger, stacks: count, maxStacks };
  return { source, bucket, op, value: valueOf(effect, count, variables), conditional };
};

const isFelt = ({ op, value, conditional }: Contribution) =>
  conditional?.stacks !== 0 && (value !== 0 || op === 'OVERRIDE');

/** What these effects add to their buckets at a moment. Effects that add nothing are left out. */
export const contributionsOf = (
  effects: readonly CollectedEffect[],
  { conditionals }: Collected,
  moment: Moment,
): readonly Contribution[] => {
  const byKey = new Map(conditionals.map((conditional) => [conditional.key, conditional]));
  return effects.map((effect) => contribute(effect, byKey, moment)).filter(isFelt);
};
