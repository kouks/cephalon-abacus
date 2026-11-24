import { z } from 'zod';

export const slotSchema = z.enum([
  'primary',
  'secondary',
  'melee',
  'archgun',
  'archmelee',
  'companion',
  'exalted',
  'amp',
  'railjack',
]);

const GUN_CLASSES = [
  'rifle',
  'shotgun',
  'sniper',
  'bow',
  'crossbow',
  'launcher',
  'speargun',
  'beam',
  'pistol',
  'dual-pistol',
  'shotgun-sidearm',
  'dual-shotgun',
  'thrown',
  'tome',
] as const;

const MELEE_CLASSES = [
  'assault-saw',
  'bayonet',
  'blade-and-whip',
  'claws',
  'dagger',
  'dual-daggers',
  'dual-nikanas',
  'dual-swords',
  'fist',
  'glaive',
  'gunblade',
  'hammer',
  'heavy-blade',
  'heavy-scythe',
  'machete',
  'nikana',
  'nunchaku',
  'polearm',
  'rapier',
  'scythe',
  'sparring',
  'staff',
  'sword',
  'sword-and-shield',
  'tonfa',
  'two-handed-nikana',
  'warfan',
  'whip',
] as const;

/** What mods filter on. The wiki's weapon classes, plus `beam`. */
export const weaponClassSchema = z.enum([...GUN_CLASSES, ...MELEE_CLASSES], {
  error: ({ input }) => `"${String(input)}" is not a weapon class (schema/weaponClass.ts)`,
});

/** A free tag mods filter on, e.g. "AOE" or "INCARNON". */
export const compatTagSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Expected an upper-case tag, e.g. "AOE"');

export type Slot = z.infer<typeof slotSchema>;
export type WeaponClass = z.infer<typeof weaponClassSchema>;
