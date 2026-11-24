import { z } from 'zod';

import { conditionalsSchema } from './conditionals';
import {
  list,
  nonNegative,
  nonNegativeInt,
  object,
  positive,
  positiveInt,
  slugSchema,
} from './primitives';

/** An equipped module. Without a rank it is at its max. */
export const moduleInstanceSchema = object({
  moduleId: slugSchema,
  rank: nonNegativeInt.exactOptional(),
});

const buildSchema = object({
  weaponId: slugSchema,
  modules: list(moduleInstanceSchema),
  conditionals: conditionalsSchema,
  /** Ids of the elemental sources, first slot first (BIBLE §6). */
  elementOrder: list(z.string().min(1)),
});

const targetSchema = object({
  id: slugSchema,
  level: z.int().min(1).max(9999),
  steelPath: z.boolean(),
  modifiers: list(moduleInstanceSchema),
});

const TOLERANCE = 1e-9;

const aimSchema = object({
  head: nonNegative,
  body: nonNegative,
  weakPoint: slugSchema.exactOptional(),
}).refine(({ head, body }) => Math.abs(head + body - 1) < TOLERANCE, 'head and body add up to 1');

/** Everything one evaluation needs (BIBLE §15). */
export const scenarioSchema = object({
  build: buildSchema,
  enemy: targetSchema,
  aim: aimSchema,
  distance: nonNegative,
  duration: positive,
  mode: z.enum(['expected', 'montecarlo']),
  seed: z.int().exactOptional(),
  runs: positiveInt.exactOptional(),
});

export type ModuleInstance = z.infer<typeof moduleInstanceSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
