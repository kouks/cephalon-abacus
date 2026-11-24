/** Elemental bonuses for tests. */
import type { DamageType } from '@abacus/data/schema/damageType';

import type { ElementSource } from '@/build/elements/types';

type Bonus = readonly [element: DamageType, ratio: number];

export const mod = (slotIndex: number, name: string, [element, ratio]: Bonus): ElementSource => ({
  origin: 'mod',
  slotIndex,
  name,
  element,
  ratio,
});

export const riven = (slotIndex: number, [element, ratio]: Bonus): ElementSource => ({
  origin: 'riven',
  slotIndex,
  name: 'Riven',
  element,
  ratio,
});

const unslotted =
  (origin: 'innate' | 'progenitor' | 'ability') =>
  (name: string, element: DamageType, ratio = 1): ElementSource => ({
    origin,
    name,
    element,
    ratio,
  });

export const innate = unslotted('innate');
export const progenitor = unslotted('progenitor');
export const ability = unslotted('ability');

export const heat = (slot: number) => mod(slot, 'Hellfire', ['heat', 0.9]);
export const cold = (slot: number) => mod(slot, 'Cryo Rounds', ['cold', 0.9]);
export const toxin = (slot: number) => mod(slot, 'Infected Clip', ['toxin', 0.9]);
export const electricity = (slot: number) => mod(slot, 'Stormbringer', ['electricity', 0.9]);
export const thermite = (slot: number) => mod(slot, 'Thermite Rounds', ['heat', 0.6]);
export const magneticMight = (slot: number) => mod(slot, 'Magnetic Might', ['magnetic', 0.6]);

export const AMPREX = innate('Amprex', 'electricity');
