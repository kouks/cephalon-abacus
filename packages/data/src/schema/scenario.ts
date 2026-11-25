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
import { progenitorSchema } from './progenitor';

/** An equipped module. Without a rank it is at its max. */
export const moduleInstanceSchema = object({
  moduleId: slugSchema,
  rank: nonNegativeInt.exactOptional(),
});

const buildSchema = object({
  weaponId: slugSchema,
  /** The firing mode the headline numbers are for. Absent: the weapon's first. */
  attackId: slugSchema.exactOptional(),
  modules: list(moduleInstanceSchema),
  conditionals: conditionalsSchema,
  /** Ids of the elemental modules, first slot first (BIBLE §6). The rest follow as listed above. */
  elementOrder: list(z.string().min(1)),
  /** Replaces the progenitor bonus of a weapon that has one. */
  progenitor: progenitorSchema.exactOptional(),
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
  /** The part that the head's share hits instead. */
  weakPoint: slugSchema.exactOptional(),
  /** Metres from the target's body that the shot lands: only an explosion gets to it. Absent: it hits. */
  missBy: nonNegative.exactOptional(),
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
