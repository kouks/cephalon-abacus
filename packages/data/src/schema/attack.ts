import { z } from 'zod';

import { damageMapSchema, procRefSchema } from './damageType';
import { list, nonNegative, object, positive, positiveInt, slugSchema } from './primitives';

const triggerSchema = z.enum([
  'semi',
  'auto',
  'autoSpool',
  'burst',
  'charge',
  'held',
  'duplex',
  'active',
]);

const shotTypeSchema = z.enum(['hitscan', 'projectile', 'aoe', 'continuous']);

const flagSchema = z.enum([
  'canHeadshot',
  'canCrit',
  'isAoE',
  'ignoresGunCO',
  'noFactionMods',
  'mergeMultishotHits',
]);

const spoolSchema = object({
  shotsToMax: positiveInt,
  /** Share of the full fire rate on the first shot. Absent until someone measures it. */
  startRate: positive.exactOptional(),
});

const falloffSchema = object({ start: nonNegative, end: positive, minPct: nonNegative });

const aoeSchema = object({
  radius: positive,
  centerPct: nonNegative,
  edgePct: nonNegative,
  losRequired: z.boolean(),
});

const beamSchema = object({
  rampStartPct: positive,
  rampTime: positive,
  decayDelay: nonNegative,
  decayTime: nonNegative,
  chain: object({ targets: positiveInt, range: positive }).exactOptional(),
});

/** Timing and geometry that only some attacks have. */
const optionalShape = {
  chargeTime: positive.exactOptional(),
  burstCount: positiveInt.exactOptional(),
  burstDelay: nonNegative.exactOptional(),
  spool: spoolSchema.exactOptional(),
  falloff: falloffSchema.exactOptional(),
  aoe: aoeSchema.exactOptional(),
  beam: beamSchema.exactOptional(),
  punchThrough: nonNegative.exactOptional(),
  range: positive.exactOptional(),
  projectileSpeed: positive.exactOptional(),
  forcedProcs: list(procRefSchema).exactOptional(),
  /** Attacks of the same weapon that this one sets off, by id. */
  linkedAttacks: list(slugSchema).exactOptional(),
  flags: list(flagSchema).exactOptional(),
};

type OptionalField = keyof typeof optionalShape;

/** The fields a trigger or shot type can't do without. */
const REQUIRED_BY: Readonly<Record<string, readonly OptionalField[]>> = {
  charge: ['chargeTime'],
  burst: ['burstCount', 'burstDelay'],
  autoSpool: ['spool'],
  aoe: ['aoe'],
  continuous: ['beam'],
};

/** One firing mode of a weapon (BIBLE §4). Chances are fractions, and times are seconds. */
export const attackSchema = object({
  id: slugSchema,
  name: z.string().min(1),
  damage: damageMapSchema,
  trigger: triggerSchema,
  shotType: shotTypeSchema,
  multishot: positive,
  critChance: nonNegative,
  /** 0 on attacks that can't crit. */
  critMultiplier: nonNegative,
  statusChance: nonNegative,
  fireRate: positive,
  /** Ammo one shot uses. */
  ammoCost: nonNegative,
  ...optionalShape,
}).superRefine((attack, context) => {
  for (const reason of [attack.trigger, attack.shotType]) {
    for (const field of REQUIRED_BY[reason] ?? []) {
      if (attack[field] !== undefined) continue;
      context.addIssue({ code: 'custom', path: [field], message: `"${reason}" needs ${field}` });
    }
  }
});

export type Attack = z.infer<typeof attackSchema>;
