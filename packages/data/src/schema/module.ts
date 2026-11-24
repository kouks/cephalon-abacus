import { z } from 'zod';

import { effectSchema, spawnInstanceSchema } from './effect';
import {
  hookRefSchema,
  itemShape,
  list,
  nonNegative,
  nonNegativeInt,
  object,
  slugSchema,
} from './primitives';
import { compatTagSchema, slotSchema, weaponClassSchema } from './weaponClass';

const rankSchema = object({
  max: nonNegativeInt,
  /**
   * How values grow: "linear" is value × (rank + 1) / (max + 1). Otherwise the share of the
   * max-rank value at each rank, from rank 0 to max.
   */
  perRank: z.union([z.literal('linear'), list(nonNegative)], {
    error: 'Expected "linear", or one share per rank',
  }),
}).refine(({ max, perRank }) => perRank === 'linear' || perRank.length === max + 1, {
  path: ['perRank'],
  error: 'Expected one share for each rank from 0 to max',
});

const compatSchema = object({
  slots: z.array(slotSchema).min(1).readonly(),
  classes: list(weaponClassSchema).exactOptional(),
  tags: list(compatTagSchema).exactOptional(),
});

/** A bundle of effects: a mod, an arcane, a buff, a debuff… (BIBLE §15). */
export const moduleSchema = object({
  ...itemShape,
  kind: z.enum([
    'mod',
    'arcane',
    'buff',
    'shard',
    'companion',
    'aura',
    'riven',
    'enemyDebuff',
    'mission',
  ]),
  rank: rankSchema.exactOptional(),
  compat: compatSchema,
  /** Modules of one group exclude each other, e.g. Serration and Amalgam Serration. */
  exclusiveGroup: slugSchema.exactOptional(),
  effects: list(effectSchema),
  spawns: list(spawnInstanceSchema).exactOptional(),
  hooks: list(hookRefSchema).exactOptional(),
});

export type Module = z.infer<typeof moduleSchema>;
