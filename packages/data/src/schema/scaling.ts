import { z } from 'zod';

import {
  itemShape,
  nonNegative,
  nonNegativeInt,
  object,
  positive,
  positiveInt,
  slugSchema,
} from './primitives';

/** The stats of an enemy that grow with its level (BIBLE §10). */
export const SCALED_STATS = ['health', 'shield', 'armor', 'overguard'] as const;

/** 1 + coefficient × levels ^ exponent. */
const endpointSchema = object({ coefficient: positive, exponent: positive });

/** How a stat grows: along the low curve, then the high one. */
const curveSchema = object({
  ...itemShape,
  kind: z.literal('curve'),
  stat: z.enum(SCALED_STATS),
  /** The scaling profiles it is for. Absent: all of them. */
  profiles: z.array(slugSchema).min(1).readonly().exactOptional(),
  /** Which levels count: those above the enemy's base level, or above 1. */
  above: z.enum(['base', 'one']),
  low: endpointSchema,
  high: endpointSchema,
  /** The levels over which the low curve becomes the high one. */
  blend: object({ from: nonNegativeInt, to: positiveInt }).refine(
    ({ from, to }) => from < to,
    'Expected from below to',
  ),
  /** What the grown stat can't leave. An enemy without the stat doesn't get the least of it. */
  limits: object({ least: nonNegative, most: positive }).exactOptional(),
});

const pointSchema = object({ level: positiveInt, value: positive });

/** The health and shields that Eximus units start from, before those grow. */
const eximusSchema = object({
  ...itemShape,
  kind: z.literal('eximus'),
  /** The multiplier by level: straight lines between the points, and flat outside of them. */
  multiplier: z.array(pointSchema).min(2).readonly(),
  /** The least of each, as a multiple of the base stat. */
  least: positive,
  /** Health: share × (base + added) × multiplier. */
  addedHealth: nonNegative,
  /** Protected: the base has shields or armor. */
  healthShare: object({ protected: positive, bare: positive }),
});

/** What the Steel Path multiplies. It is a game mode: an enemy's level is the one it has in it. */
const steelPathSchema = object({
  ...itemShape,
  kind: z.literal('steelPath'),
  health: positive,
  shield: positive,
});

/**
 * The stats the game keeps as whole numbers once grown, and how it rounds them: shields to the
 * nearest (T-46), armor down, after strips too (T-48).
 */
const wholeSchema = object({
  ...itemShape,
  kind: z.literal('whole'),
  stats: z.array(z.enum(SCALED_STATS)).min(1).readonly(),
  rounding: z.enum(['nearest', 'down']),
});

export const scalingRuleSchema = z.discriminatedUnion('kind', [
  curveSchema,
  eximusSchema,
  steelPathSchema,
  wholeSchema,
]);

export type ScaledStat = (typeof SCALED_STATS)[number];
export type ScalingRule = z.infer<typeof scalingRuleSchema>;
export type ScalingCurve = z.infer<typeof curveSchema>;
export type EximusRule = z.infer<typeof eximusSchema>;
export type SteelPathRule = z.infer<typeof steelPathSchema>;
export type WholeRule = z.infer<typeof wholeSchema>;
