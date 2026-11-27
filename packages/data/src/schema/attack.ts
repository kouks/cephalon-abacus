import { z } from 'zod';

import { damageMapSchema } from './damageType';
import { list, nonNegative, object, positive, positiveInt, slugSchema } from './primitives';

export const attackTriggerSchema = z.enum([
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

/** Metres, and the share of the damage that is left at the end. */
const falloffSchema = object({
  start: nonNegative,
  end: positive,
  minPct: nonNegative.max(1),
}).refine(({ start, end }) => start < end, 'Falloff ends further away than it starts');

/** Shares of the damage: at the centre, and what the arsenal and the wiki say is left at the radius. */
const aoeSchema = object({
  radius: positive,
  centerPct: positive,
  edgePct: nonNegative,
  losRequired: z.boolean(),
}).refine(
  ({ centerPct, edgePct }) => edgePct <= centerPct,
  'An explosion is no stronger at its radius than in its centre',
);

const beamSchema = object({
  rampStartPct: positive,
  rampTime: positive,
  decayDelay: nonNegative,
  decayTime: nonNegative,
  chain: object({ targets: positiveInt, range: positive }).exactOptional(),
});

/**
 * A status the attack always inflicts, whatever its status chance, by its id in statuses.json:
 * Nagantaka's Knockback (Impact). `within` is how near the target has to be: Arca Plasmor's reaches
 * 14 m.
 */
const forcedProcSchema = object({
  status: slugSchema,
  count: positive,
  within: positive.exactOptional(),
});

/** Timing and geometry that only some attacks have. */
const optionalShape = {
  chargeTime: positive.exactOptional(),
  /** What follows a charged shot: the fire delay, a reload (bows), or nothing (Lanka). */
  afterCharge: z.enum(['fireDelay', 'reload', 'none']).exactOptional(),
  burstCount: positiveInt.exactOptional(),
  burstDelay: nonNegative.exactOptional(),
  spool: spoolSchema.exactOptional(),
  falloff: falloffSchema.exactOptional(),
  aoe: aoeSchema.exactOptional(),
  beam: beamSchema.exactOptional(),
  punchThrough: nonNegative.exactOptional(),
  range: positive.exactOptional(),
  projectileSpeed: positive.exactOptional(),
  forcedProcs: list(forcedProcSchema).exactOptional(),
  /** Attacks of the same weapon that this one sets off, by id. */
  linkedAttacks: list(slugSchema).exactOptional(),
  flags: list(flagSchema).exactOptional(),
};

type OptionalField = keyof typeof optionalShape;

/** The fields a trigger or shot type can't do without. */
const REQUIRED_BY: Readonly<Record<string, readonly OptionalField[]>> = {
  charge: ['chargeTime', 'afterCharge'],
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
  trigger: attackTriggerSchema,
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
