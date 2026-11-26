import { z } from 'zod';

import { itemShape, object, positive, positiveInt } from './primitives';

/** How a new stack of a status joins the ones an enemy has (BIBLE §8). */
const stackingSchema = z.discriminatedUnion('kind', [
  /** Each stack lasts its own time, and there is no limit: Bleed, Poison, Tesla Chain. */
  object({ kind: z.literal('independent') }),
  /** Each stack lasts its own time; past the most, the oldest goes, however long it has left. */
  object({ kind: z.literal('capped'), most: positiveInt }),
  /** One instance: a new stack joins it and makes every stack last the longest duration (Heat). */
  object({ kind: z.literal('merged') }),
]);

/** A status effect: what a damage type procs, by the `proc` slug in damageTypes.json. */
export const statusSchema = object({
  ...itemShape,
  /** How long a stack lasts, in seconds, before status duration bonuses. */
  duration: positive,
  stacking: stackingSchema,
  confidence: z.enum(['W', 'W?', 'C', 'T']),
});

export type Status = z.infer<typeof statusSchema>;
export type Stacking = z.infer<typeof stackingSchema>;
