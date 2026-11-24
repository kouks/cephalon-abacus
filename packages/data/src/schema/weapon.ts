import { z } from 'zod';

import type { Attack } from './attack';
import { attackSchema } from './attack';
import { damageTypeSchema } from './damageType';
import { effectSchema } from './effect';
import { moduleSchema } from './module';
import {
  hookRefSchema,
  itemShape,
  list,
  nonNegative,
  object,
  positive,
  positiveInt,
} from './primitives';
import { checkSharedStacks } from './sharedStacks';
import { compatTagSchema, slotSchema, weaponClassSchema } from './weaponClass';

const reloadShape = {
  magazine: positive,
  /** Absent: unlimited. */ maxAmmo: positive.exactOptional(),
};

const ammoSchema = z.discriminatedUnion('reloadStyle', [
  object({ ...reloadShape, reloadStyle: z.literal('magazine'), reloadTime: nonNegative }),
  object({ ...reloadShape, reloadStyle: z.literal('perShell'), reloadTime: nonNegative }),
  object({
    ...reloadShape,
    reloadStyle: z.literal('battery'),
    regenRate: positive,
    regenDelay: nonNegative,
  }),
]);

const progenitorSchema = object({
  element: damageTypeSchema,
  /** Share of base damage. Valence Fusion caps it at 60%. */
  pct: z.number().min(0.25).max(0.6),
});

const sniperComboSchema = object({
  gainPerHit: positive,
  thresholds: list(positive),
  multipliers: list(positive),
  duration: positive,
}).refine(({ thresholds, multipliers }) => thresholds.length === multipliers.length, {
  path: ['multipliers'],
  error: 'Expected one multiplier per threshold',
});

const meleeSchema = object({
  range: positive,
  comboDuration: positive,
  followThrough: nonNegative,
  heavyWindUp: nonNegative,
  stanceClass: weaponClassSchema,
});

const incarnonSchema = object({
  form: attackSchema,
  charge: object({
    source: z.enum(['weakPointHit', 'directHit', 'heavyAtCombo']),
    perHit: positive,
    max: positive,
  }),
  evolutions: list(object({ tier: positiveInt, choices: z.array(moduleSchema).min(1).readonly() })),
});

type AttackLists = {
  readonly attacks: readonly Attack[];
  readonly incarnon?: { readonly form: Attack };
};

/** Attack ids are unique in a weapon, and linked attacks name one of them. */
const checkAttacks = ({ attacks, incarnon }: AttackLists, context: z.RefinementCtx) => {
  const all = [
    ...attacks.map((attack, index) => ({ attack, path: ['attacks', index] })),
    ...(incarnon === undefined ? [] : [{ attack: incarnon.form, path: ['incarnon', 'form'] }]),
  ];
  const ids = all.map(({ attack }) => attack.id);
  const report = (path: (string | number)[], message: string) => {
    context.addIssue({ code: 'custom', path, message });
  };
  all.forEach(({ attack, path }, position) => {
    if (ids.indexOf(attack.id) !== position) {
      report([...path, 'id'], `Another attack of this weapon has the id "${attack.id}"`);
    }
    for (const [index, target] of (attack.linkedAttacks ?? []).entries()) {
      if (target !== attack.id && ids.includes(target)) continue;
      report([...path, 'linkedAttacks', index], `No other attack here has the id "${target}"`);
    }
  });
};

/** A weapon is data only: weapon-level fields plus its attacks (BIBLE §4). */
export const weaponSchema = object({
  ...itemShape,
  slot: slotSchema,
  class: list(weaponClassSchema),
  compatTags: list(compatTagSchema).exactOptional(),
  maxRank: z.union([z.literal(30), z.literal(40)], { error: 'Expected 30 or 40' }),
  progenitor: progenitorSchema.exactOptional(),
  innatePassives: list(effectSchema).exactOptional(),
  perkHooks: list(hookRefSchema).exactOptional(),
  incarnon: incarnonSchema.exactOptional(),
  ammo: ammoSchema.exactOptional(),
  zoomLevels: list(object({ zoom: positive, effects: list(effectSchema) })).exactOptional(),
  sniperCombo: sniperComboSchema.exactOptional(),
  melee: meleeSchema.exactOptional(),
  attacks: z.array(attackSchema).min(1).readonly(),
}).superRefine((weapon, context) => {
  checkAttacks(weapon, context);
  checkSharedStacks(weapon.innatePassives ?? [], context);
});

export type Weapon = z.infer<typeof weaponSchema>;
