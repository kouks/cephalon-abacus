import { z } from 'zod';

import { bucketNameSchema, opSchema, scopeSchema } from './effect';
import {
  gameVersionSchema,
  object,
  positive,
  positiveInt,
  slugSchema,
  sourceSchema,
} from './primitives';

/** Which part of the pipeline reads a bucket (BIBLE §3). */
export const STAGES = [
  /** Build, step 3: the attack's modded stats. */
  'stats',
  /** Build, step 4: damage per type, before quantization. */
  'composition',
  /** Resolve, step 7: crit terms that depend on the target or the body part. */
  'crit',
  /** Resolve, step 9: a factor of the direct-damage chain. */
  'hit',
  /** Resolve, step 11: a factor of a status effect's damage. */
  'proc',
  /** The melee combo counter. */
  'combo',
  /** Changes to the enemy. */
  'target',
] as const;

const membersSchema = z.union(
  [z.array(slugSchema).min(1).readonly(), z.enum(['factionModGroup', 'any'])],
  { error: 'Expected a list of ids, "factionModGroup" or "any"' },
);

/** A named stat slot that effects write into (BIBLE §5): buckets.json holds every one. */
export const bucketSchema = object({
  id: bucketNameSchema,
  name: z.string().min(1),
  source: sourceSchema,
  gameVersion: gameVersionSchema,
  /** The op most effects on it use. Each effect states its own. */
  op: opSchema,
  /** What it reaches, and how many times it applies there: faction bonuses hit a DoT twice. */
  scope: z.partialRecord(scopeSchema, positiveInt).readonly(),
  stage: z.enum(STAGES),
  confidence: z.enum(['W', 'W?', 'C', 'T']),
  /** For a family such as damage.faction.<group>: what may follow. Absent: not a family. */
  members: membersSchema.exactOptional(),
  /** The highest total the game allows. */
  max: positive.exactOptional(),
});

export type Stage = (typeof STAGES)[number];
export type Bucket = z.infer<typeof bucketSchema>;
