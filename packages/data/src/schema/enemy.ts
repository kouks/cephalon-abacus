import { z } from 'zod';

import { damageTypeSchema } from './damageType';
import { bodyPartSchema } from './effect';
import {
  hookRefSchema,
  itemShape,
  list,
  nonNegative,
  object,
  positive,
  positiveInt,
  slugSchema,
} from './primitives';
import type { ScaledStat } from './scaling';

/** A place to hit (BIBLE §11). */
const enemyPartSchema = object({
  id: slugSchema,
  /** What it multiplies damage by. 0: it takes none. */
  multiplier: nonNegative,
  /** Absent: an ordinary part of the body. */
  countsAs: z.array(bodyPartSchema).min(1).readonly().exactOptional(),
  /** What it multiplies the crit multiplier by: 2 on most heads that have one. */
  headcrit: positive.exactOptional(),
  /** It raises every hit by a crit tier, white ones too (BIBLE §7). */
  promotes: z.literal(true).exactOptional(),
});

const partsSchema = list(enemyPartSchema)
  .refine((parts) => parts.some(({ id }) => id === 'body'), 'Expected a part "body"')
  .refine(
    (parts) => new Set(parts.map(({ id }) => id)).size === parts.length,
    'Expected each part once',
  );

/** An enemy preset: its stats at its base level, and what hits on it meet (BIBLE §10). */
export const enemySchema = object({
  ...itemShape,
  faction: slugSchema,
  /** Whose curves its stats grow along: usually its faction's. */
  scalingProfile: slugSchema,
  baseLevel: positiveInt,
  baseHealth: positive,
  baseShield: nonNegative,
  baseArmor: nonNegative,
  baseOverguard: nonNegative,
  bodyParts: partsSchema,
  /** The most stacks of a status it takes: 4 of Cold on bosses. Absent: the status' own cap. */
  statusCaps: z.partialRecord(damageTypeSchema, positiveInt).readonly().exactOptional(),
  flags: list(z.enum(['boss', 'eximus', 'hasAttenuation'])).exactOptional(),
  /** Damage reductions of its own, by hook. */
  drHooks: list(hookRefSchema).exactOptional(),
});

export type EnemyPart = z.infer<typeof enemyPartSchema>;
export type Enemy = z.infer<typeof enemySchema>;

/** An enemy's stats at its base level. */
export const baseOf = (enemy: Enemy): Readonly<Record<ScaledStat, number>> => ({
  health: enemy.baseHealth,
  shield: enemy.baseShield,
  armor: enemy.baseArmor,
  overguard: enemy.baseOverguard,
});
