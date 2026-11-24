import { z } from 'zod';

import { damageTypeSchema, procRefSchema } from './damageType';
import { list, nonNegative, nonNegativeInt, object } from './primitives';

/** What one hit did, and every factor that made it (BIBLE §15). */
export const hitTraceSchema = object({
  /** Simulated seconds. */
  t: nonNegative,
  pellet: nonNegativeInt,
  /** Every multiplier in the chain, by name. */
  factors: z.record(z.string().min(1), z.number()).readonly(),
  perType: z.partialRecord(damageTypeSchema, nonNegative).readonly(),
  layer: z.enum(['overguard', 'shield', 'health']),
  procs: list(procRefSchema),
});

export type HitTrace = z.infer<typeof hitTraceSchema>;
