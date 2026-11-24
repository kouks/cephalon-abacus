import type { z } from 'zod';

import type { Effect } from './effect';

/**
 * Effects of one item with the same trigger are one conditional: they switch together, so they
 * have to stack alike.
 */
export const checkSharedStacks = (effects: readonly Effect[], context: z.RefinementCtx) => {
  const stacksOf = new Map<string, string>();
  for (const { condition } of effects) {
    if (condition === undefined) continue;
    const stacks = JSON.stringify(condition.stacks ?? null);
    const first = stacksOf.get(condition.trigger);
    if (first !== undefined && first !== stacks) {
      context.addIssue({
        code: 'custom',
        message: `Effects on "${condition.trigger}" stack differently, but switch as one`,
      });
    }
    stacksOf.set(condition.trigger, stacks);
  }
};
