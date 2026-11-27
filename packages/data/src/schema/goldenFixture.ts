import { z } from 'zod';

import { damageTypeSchema } from './damageType';
import { layerSchema } from './damageTypeRule';
import { enemySchema } from './enemy';
import { moduleSchema } from './module';
import {
  gameVersionSchema,
  list,
  nonNegative,
  object,
  positive,
  positiveInt,
  slugSchema,
} from './primitives';
import { scenarioSchema } from './scenario';
import { weaponSchema } from './weapon';

/** The colours of damage numbers, by crit tier. */
export const COLOURS = ['white', 'yellow', 'orange', 'red'] as const;

const colourSchema = z.enum(COLOURS);

/** The hits that a layer took until it was gone. */
const depletedSchema = object({
  layer: layerSchema,
  hits: z.partialRecord(colourSchema, positiveInt).readonly(),
  /** The one that finished it, which is among the hits. */
  last: colourSchema,
}).refine(({ hits, last }) => hits[last] !== undefined, 'Expected the last hit among the hits');

/** The numbers one hit showed on each layer: on a fresh enemy, or after other hits of the same attack. */
const layeredSchema = object({
  before: z.partialRecord(colourSchema, positiveInt).readonly().exactOptional(),
  colour: colourSchema,
  shown: z
    .partialRecord(layerSchema, nonNegative)
    .readonly()
    .refine((shown) => Object.keys(shown).length > 0, 'Expected a number on some layer'),
});

/** A DoT tick's number, the colour of the hit whose proc it is, and how many it dealt (BIBLE §8). */
const tickSchema = object({
  status: slugSchema,
  of: colourSchema,
  shown: nonNegative,
  count: positiveInt.exactOptional(),
});

/** What was seen in the game, exactly as it was reported. */
const observedSchema = object({
  /** The arsenal's damage per type, which is not quantized. */
  arsenalDamage: z.partialRecord(damageTypeSchema, nonNegative).readonly().exactOptional(),
  /** The arsenal's total damage, which counts multishot. */
  arsenalTotal: nonNegative.exactOptional(),
  /** Other numbers of the arsenal, by the name of the stat: fireRate, magazine… */
  arsenal: z.record(z.string().min(1), nonNegative).readonly().exactOptional(),
  /** The numbers that hits showed. */
  hits: z.partialRecord(colourSchema, nonNegative).readonly().exactOptional(),
  /** The attack they are of, of those the shot sets off: an explosion. Absent: the shot's own. */
  hitsOf: slugSchema.exactOptional(),
  /** The seconds that some shots took, or a whole magazine. */
  firing: list(
    object({ shots: z.union([positive, z.literal('magazine')]), seconds: positive }),
  ).exactOptional(),
  /** What wore an enemy down, layer by layer. The hits go through the layers as the engine has them. */
  depleted: z.array(depletedSchema).min(1).readonly().exactOptional(),
  layered: z.array(layeredSchema).min(1).readonly().exactOptional(),
  /** Types that never proc'd. */
  neverProcs: list(damageTypeSchema).exactOptional(),
  /** The ticks of procs the hits inflicted, by the status. */
  ticks: list(tickSchema).exactOptional(),
})
  .refine((observed) => Object.keys(observed).length > 0, 'Expected something observed')
  .refine(({ hits, hitsOf }) => hitsOf === undefined || hits !== undefined, 'hitsOf needs hits');

/** How far the exact value may be from the reported one: half a unit of its last digit, or more. */
const toleranceSchema = object({
  arsenal: nonNegative.exactOptional(),
  hits: nonNegative.exactOptional(),
  seconds: nonNegative.exactOptional(),
});

const reportSchema = object({
  on: z.iso.date(),
  /** Word for word, with typos fixed. */
  words: z.string().min(1),
});

/** An in-game test that the engine has to agree with (BIBLE §16). */
export const goldenFixtureSchema = object({
  id: z.string().regex(/^T-[1-9]\d*$/, 'Expected a test, e.g. "T-4"'),
  question: z.string().min(1),
  bible: z.string().regex(/^§\d+$/, 'Expected a section, e.g. "§7"'),
  gameVersion: gameVersionSchema,
  reports: z.array(reportSchema).min(1).readonly(),
  /** What the reader should know: what was predicted, and what had to be inferred. */
  notes: z.string().min(1).exactOptional(),
  /** What the library doesn't have, e.g. a Riven. */
  modules: list(moduleSchema).exactOptional(),
  weapons: list(weaponSchema).exactOptional(),
  enemies: list(enemySchema).exactOptional(),
  tolerance: toleranceSchema,
  cases: z
    .array(object({ name: z.string().min(1), scenario: scenarioSchema, observed: observedSchema }))
    .min(1)
    .readonly(),
});

export type Colour = z.infer<typeof colourSchema>;
export type Depleted = z.infer<typeof depletedSchema>;
export type Layered = z.infer<typeof layeredSchema>;
export type Tick = z.infer<typeof tickSchema>;
export type Observed = z.infer<typeof observedSchema>;
export type Tolerance = z.infer<typeof toleranceSchema>;
export type GoldenFixture = z.infer<typeof goldenFixtureSchema>;
