import { z } from 'zod';

import { damageTypeSchema } from './damageType';
import { itemShape, object, positive, slugSchema } from './primitives';

/** The layers damage goes through, in order (BIBLE §10). */
export const LAYERS = ['overguard', 'shield', 'health'] as const;

export const layerSchema = z.enum(LAYERS);

const pairSchema = z
  .tuple([damageTypeSchema, damageTypeSchema])
  .refine(([first, second]) => first !== second, 'Expected two different types')
  .readonly();

/** How a damage type behaves (BIBLE §6, §8, §10): damageTypes.json holds one per type. */
export const damageTypeRuleSchema = object({
  ...itemShape,
  id: damageTypeSchema,
  group: z.enum(['physical', 'primary', 'secondary', 'special']),
  /** The two primaries a secondary combines from. */
  combinesFrom: pairSchema.exactOptional(),
  /** The status effect it procs. Absent: none. */
  proc: slugSchema.exactOptional(),
  /** The layers it damages, each with a multiplier. A layer that is absent is skipped. */
  layers: z.partialRecord(layerSchema, positive).readonly(),
  bypassArmor: z.boolean(),
}).refine(({ group, combinesFrom }) => (group === 'secondary') === (combinesFrom !== undefined), {
  path: ['combinesFrom'],
  error: 'Secondaries, and only they, combine from two primaries',
});

export type Layer = z.infer<typeof layerSchema>;
export type DamageTypeRule = z.infer<typeof damageTypeRuleSchema>;
