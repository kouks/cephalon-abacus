import { z } from 'zod';

import { bucketNameSchema, opSchema, scopeSchema } from './effect';
import { itemShape, list, object, positive, positiveInt, slugSchema } from './primitives';

/** How a new stack of a status joins the ones an enemy has (BIBLE §8). */
const stackingSchema = z.discriminatedUnion('kind', [
  /** Each stack lasts its own time, and there is no limit: Bleed, Poison, Tesla Chain. */
  object({ kind: z.literal('independent') }),
  /** Each stack lasts its own time; past the most, the oldest goes, however long it has left. */
  object({ kind: z.literal('capped'), most: positiveInt }),
  /** One instance: a new stack joins it and makes every stack last the longest duration (Heat). */
  object({ kind: z.literal('merged') }),
]);

/**
 * What a status does to the hits it meets, by its stacks: an effect on a bucket worth `first` at one
 * stack and `more` for each after it (BIBLE §8). `atMost` is what it is worth once the status reaches
 * its most: Cold's +1.0 crit damage while the enemy is frozen.
 */
const statusEffectSchema = object({
  bucket: bucketNameSchema,
  op: opSchema,
  first: z.number(),
  more: z.number(),
  atMost: z.number().exactOptional(),
  /** The hits it reaches. Absent: all of them. Cold's and Puncture's miss AoE. */
  scope: list(scopeSchema).exactOptional(),
});

/**
 * A status effect, by the `proc` slug that damage types name in damageTypes.json, or that only some
 * attacks inflict: Microwave.
 */
export const statusSchema = object({
  ...itemShape,
  /** How long a stack lasts, in seconds, before status duration bonuses. Absent: until it dies. */
  duration: positive.exactOptional(),
  stacking: stackingSchema,
  /** The most stacks an enemy takes while it has Overguard left: Cold's 4. */
  overguardMost: positiveInt.exactOptional(),
  effects: list(statusEffectSchema).exactOptional(),
  confidence: z.enum(['W', 'W?', 'C', 'T']),
});

export type Status = z.infer<typeof statusSchema>;
export type Stacking = z.infer<typeof stackingSchema>;
export type StatusEffect = z.infer<typeof statusEffectSchema>;

/** A status a hit inflicts, by its id in statuses.json: a share of one in expected value. */
export const procSchema = object({ status: slugSchema, count: positive });

export type Proc = z.infer<typeof procSchema>;
