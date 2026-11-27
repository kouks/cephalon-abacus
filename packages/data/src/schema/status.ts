import { z } from 'zod';

import { itemShape, nonNegative, object, positive, positiveInt, slugSchema } from './primitives';

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
 * What a status changes on the enemy, by its stacks: `first` for one, and `more` for each after it.
 * More kinds of change come with ABA-24.
 */
const effectSchema = object({
  /** The status chance the enemy takes, multiplied or added to (Tau, T-9). */
  on: z.enum(['statusChanceTaken']),
  first: positive,
  more: nonNegative,
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
  effect: effectSchema.exactOptional(),
  confidence: z.enum(['W', 'W?', 'C', 'T']),
});

export type Status = z.infer<typeof statusSchema>;
export type Stacking = z.infer<typeof stackingSchema>;
export type StatusEffect = z.infer<typeof effectSchema>;

/** A status a hit inflicts, by its id in statuses.json: a share of one in expected value. */
export const procSchema = object({ status: slugSchema, count: positive });

export type Proc = z.infer<typeof procSchema>;
