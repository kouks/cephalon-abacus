import { aggregate } from '@/build/aggregate';
import type { BuiltAttack } from '@/build/buildAttack';
import type { Contribution } from '@/build/types';

import type { Defence } from './defence';

/**
 * Strips on the enemy's armor (BIBLE §10): shares of the most (STACKING_MULTIPLY) add up, shares of
 * what is left (MULTIPLY: Heat, Corrosive) multiply, and flat ones (ADD) come last.
 */
export const STRIPS = 'enemy.armor';

/** The armor a hit meets, and the strips that took it down. */
export type ArmorMet = { readonly value: number; readonly strips: readonly Contribution[] };

/**
 * The armor after the strips the attack sees. It can go below the least of 200, never below 0. The
 * cap of 2,700 comes first, unless the assumption armorCappedBeforeStrips says otherwise (T-6).
 */
export const armorMet = (
  { armor, uncappedArmor }: Defence,
  { totals, assumptions }: Pick<BuiltAttack, 'totals' | 'assumptions'>,
): ArmorMet => {
  const total = totals.get(STRIPS);
  if (total === undefined || total.contributions.length === 0) return { value: armor, strips: [] };
  const isCappedFirst = assumptions.armorCappedBeforeStrips;
  const from = isCappedFirst ? armor : (uncappedArmor ?? armor);
  const stripped = Math.max(aggregate(total, from), 0);
  const value = isCappedFirst || uncappedArmor === undefined ? stripped : Math.min(stripped, armor);
  return { value, strips: total.contributions };
};
