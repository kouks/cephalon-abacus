import type { Conditionals, ConditionalState } from '@abacus/data/schema/conditionals';
import type { Condition, Trigger } from '@abacus/data/schema/condition';

import type { CollectedEffect, Conditional, Source, Warning } from './types';

export const conditionalKey = (sourceId: string, trigger: Trigger) => `${sourceId} ${trigger}`;

/** The condition that switches an effect. `always` is no condition. */
export const switchOf = ({ condition }: CollectedEffect): Condition | undefined =>
  condition?.trigger === 'always' ? undefined : condition;

const startingStacks = (state: ConditionalState, max: number) => {
  if (state === 'on') return max;
  return state === 'off' ? 0 : Math.min(state.stacks, max);
};

type Found = { readonly source: Source; readonly condition: Condition };

const switchOne = ({ source, condition }: Found, settings: Conditionals): Conditional => {
  const { trigger } = condition;
  const override = settings.overrides.find(
    (entry) => entry.sourceId === source.id && entry.trigger === trigger,
  );
  const state = override?.state ?? settings.all;
  const maxStacks = condition.stacks?.max ?? 1;
  const key = conditionalKey(source.id, trigger);
  return { key, source, trigger, state, maxStacks, stacks: startingStacks(state, maxStacks) };
};

const warnStacks = (conditionals: readonly Conditional[]): readonly Warning[] =>
  conditionals.flatMap(({ source, trigger, state, maxStacks: max }) =>
    typeof state === 'object' && state.stacks > max
      ? [{ code: 'stacksAboveMax', sourceId: source.id, trigger, stacks: state.stacks, max }]
      : [],
  );

const warnUnused = (
  conditionals: readonly Conditional[],
  { overrides }: Conditionals,
): readonly Warning[] => {
  const keys = new Set(conditionals.map(({ key }) => key));
  return overrides
    .filter(({ sourceId, trigger }) => !keys.has(conditionalKey(sourceId, trigger)))
    .map(({ sourceId, trigger }) => ({ code: 'unusedOverride', sourceId, trigger }));
};

const ownSwitch = (effect: CollectedEffect): readonly Found[] => {
  const condition = switchOf(effect);
  return condition === undefined ? [] : [{ source: effect.source, condition }];
};

/** What an effect requires is a switch too. It doesn't stack. */
const requiredSwitches = (effect: CollectedEffect): readonly Found[] =>
  ownSwitch(effect).flatMap(({ source, condition: { requires = [], target } }) =>
    requires.map((trigger) => ({ source, condition: { trigger, target } })),
  );

/** Every switch in the build, as it is set. */
export const findConditionals = (effects: readonly CollectedEffect[], settings: Conditionals) => {
  const found = new Map<string, Conditional>();
  for (const entry of [...effects.flatMap(ownSwitch), ...effects.flatMap(requiredSwitches)]) {
    const conditional = switchOne(entry, settings);
    if (!found.has(conditional.key)) found.set(conditional.key, conditional);
  }
  const conditionals = [...found.values()];
  return {
    conditionals,
    warnings: [...warnStacks(conditionals), ...warnUnused(conditionals, settings)],
  };
};
