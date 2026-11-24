import type { Attack } from '@abacus/data/schema/attack';

import type { Assumptions } from '@/assumptions';
import type { BucketTotal } from '@/build/aggregate';
import { aggregate } from '@/build/aggregate';
import type { BucketTotals } from '@/build/totalBuckets';

import { canCrit } from './critChance';
import type { ModdedStat } from './moddedStat';
import { totalIn } from './moddedStat';

/** A crit multiplier, and what the body part multiplied it by: 2 for most headcrits, else 1. */
export type CritMultiplier = ModdedStat & { readonly headcrit: number };

type Rules = {
  readonly totals: BucketTotals;
  readonly assumptions: Assumptions;
  readonly headcrit?: number;
};

const MAX_BASE = 32;
const STEPS = 4095;

/** The game keeps a base crit multiplier in 12 bits: 4,095 steps up to 32 (BIBLE §7). */
export const quantizeCritMultiplier = (base: number): number =>
  (Math.round((Math.min(base, MAX_BASE) * STEPS) / MAX_BASE) * MAX_BASE) / STEPS;

/** An attack that can't crit has 1x, which counts where a body part raises its tier anyway. */
const baseOf = (attack: Attack) =>
  canCrit(attack) ? quantizeCritMultiplier(attack.critMultiplier) : 1;

type Terms = {
  readonly base: number;
  readonly modded: number;
  readonly flat: BucketTotal;
  readonly headcrit: number;
};

/** A headcrit multiplies the base alone, the modded multiplier, or its flat bonuses too. */
const withHeadcrit = ({ base, modded, flat, headcrit }: Terms, assumptions: Assumptions) => {
  if (!assumptions.headcritScalesModded) return aggregate(flat, modded + base * (headcrit - 1));
  if (!assumptions.headcritScalesFlat) return aggregate(flat, modded * headcrit);
  return aggregate(flat, modded) * headcrit;
};

/** (quantized base × (1 + relative) + flat) × headcrit × final (BIBLE §7). */
export const modCritMultiplier = (
  attack: Attack,
  { totals, assumptions, headcrit = 1 }: Rules,
): CritMultiplier => {
  const base = baseOf(attack);
  const relative = totalIn(totals, 'crit.damage');
  const flat = totalIn(totals, 'crit.damageFlat');
  const final = totalIn(totals, 'crit.damageFinal');
  const terms = { base, modded: aggregate(relative, base), flat, headcrit };
  return {
    base,
    value: Math.max(aggregate(final, withHeadcrit(terms, assumptions)), 0),
    totals: [relative, flat, final],
    headcrit,
  };
};
