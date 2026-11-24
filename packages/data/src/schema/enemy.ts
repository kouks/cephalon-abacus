import type { z } from 'zod';

import { itemShape, nonNegative, object, positiveInt, slugSchema } from './primitives';

/** An enemy preset. A stub: body parts, scaling and damage reduction come with ABA-19. */
export const enemySchema = object({
  ...itemShape,
  faction: slugSchema,
  baseLevel: positiveInt,
  baseHealth: nonNegative,
  baseShield: nonNegative,
  baseArmor: nonNegative,
  baseOverguard: nonNegative,
});

export type Enemy = z.infer<typeof enemySchema>;
