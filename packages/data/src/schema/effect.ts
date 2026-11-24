import { z } from 'zod';

import { conditionSchema } from './condition';
import { damageTypeSchema } from './damageType';
import { list, object, slugSchema } from './primitives';

export const opSchema = z.enum(['STACKING_MULTIPLY', 'MULTIPLY', 'ADD', 'OVERRIDE']);

/** What a bonus reaches: the direct hit, proc DoTs, extra hits, AoE (BIBLE §5). */
export const scopeSchema = z.enum(['direct', 'proc', 'extraHit', 'aoe']);

/** The shape of a bucket name. That the bucket exists is checked against buckets.json (ABA-7). */
export const bucketNameSchema = z
  .string()
  .regex(/^[a-z][A-Za-z0-9-]*(?:\.[a-z][A-Za-z0-9-]*)*$/, 'Expected a bucket, e.g. "damage.base"');

/** What a value can scale with. `comboTier` is the combo multiplier minus 1. */
const variableSchema = z.enum(['stack', 'statusType', 'comboTier', 'abilityStrength']);

/** A value that scales: `value` times each variable. */
const exprSchema = object({
  value: z.number(),
  times: z.array(variableSchema).min(1).readonly(),
});

const valueSchema = z.union([z.number(), exprSchema], {
  error: 'Expected a number, or { value, times: ["stack" | "statusType" | …] }',
});

/** A hit location that bonuses ask for. A part can be both (BIBLE §11). */
export const bodyPartSchema = z.enum(['head', 'weakPoint']);

const filterSchema = object({
  attackTags: list(z.string().min(1)).exactOptional(),
  damageTypes: list(damageTypeSchema).exactOptional(),
  bodyPart: bodyPartSchema.exactOptional(),
});

/** One stat contribution from any source (BIBLE §15). */
export const effectSchema = object({
  bucket: bucketNameSchema,
  op: opSchema,
  value: valueSchema,
  scope: z.array(scopeSchema).min(1).readonly().exactOptional(),
  condition: conditionSchema.exactOptional(),
  filter: filterSchema.exactOptional(),
});

/** A separate hit that a hit creates, e.g. Xata's Whisper (BIBLE §13). Read from ABA-34 on. */
export const spawnInstanceSchema = object({
  id: slugSchema,
  /** Share of the hit that created it. */
  pct: z.number().positive(),
  /** "weapon" copies the hit's own types. */
  damageType: z.union([damageTypeSchema, z.literal('weapon')]),
  procRule: z.enum(['never', 'statusChance', 'always']),
  critRule: z.enum(['never', 'independent']),
  /** Whether faction bonuses apply again on top of the hit's own. */
  factionRule: z.enum(['once', 'again']),
});

export type Variable = z.infer<typeof variableSchema>;
export type Op = z.infer<typeof opSchema>;
export type Scope = z.infer<typeof scopeSchema>;
export type BodyPart = z.infer<typeof bodyPartSchema>;
export type Expr = z.infer<typeof exprSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type SpawnInstance = z.infer<typeof spawnInstanceSchema>;
