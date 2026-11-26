import { z } from 'zod';

import { positive } from './primitives';

/** The 20 damage types (BIBLE §6). Their rules are data: see damageTypes.json. */
export const DAMAGE_TYPES = [
  'impact',
  'puncture',
  'slash',
  'heat',
  'cold',
  'electricity',
  'toxin',
  'blast',
  'corrosive',
  'gas',
  'magnetic',
  'radiation',
  'viral',
  'void',
  'tau',
  'true',
  'cinematic',
  'finisher',
  'shield-drain',
  'energy-drain',
] as const;

export const damageTypeSchema = z.enum(DAMAGE_TYPES);

/** Damage per type. Absent types deal none. */
export const damageMapSchema = z
  .partialRecord(damageTypeSchema, positive)
  .refine((damage) => Object.keys(damage).length > 0, {
    error: 'An attack deals at least one damage type',
    // A misspelt type is already an error of its own.
    when: ({ issues }) => issues.length === 0,
  })
  .readonly();

export type DamageType = z.infer<typeof damageTypeSchema>;
export type DamageMap = z.infer<typeof damageMapSchema>;
