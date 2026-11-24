import { z } from 'zod';

import { triggerSchema } from './condition';
import { list, nonNegativeInt, object, slugSchema } from './primitives';

/**
 * The stacks a conditional starts with: "on" is all of them, "off" is none, or a number of them.
 * A simulation adds and removes stacks from there as its conditions are met.
 */
const stateSchema = z.union([z.enum(['on', 'off']), object({ stacks: nonNegativeInt })], {
  error: 'Expected "on", "off" or { stacks }',
});

const overrideSchema = object({
  /** The module or weapon the conditional belongs to. */
  sourceId: slugSchema,
  trigger: triggerSchema,
  state: stateSchema,
});

type Override = z.infer<typeof overrideSchema>;

const isRepeated = (overrides: readonly Override[]) => {
  const keys = overrides.map(({ sourceId, trigger }) => `${sourceId} ${trigger}`);
  return new Set(keys).size < keys.length;
};

/** The global switch for a build's conditionals, and the conditionals that differ from it. */
export const conditionalsSchema = object({
  all: z.enum(['on', 'off']),
  overrides: list(overrideSchema),
}).refine(({ overrides }) => !isRepeated(overrides), {
  path: ['overrides'],
  error: 'Two overrides name the same conditional',
});

export type ConditionalState = z.infer<typeof stateSchema>;
export type Conditionals = z.infer<typeof conditionalsSchema>;
