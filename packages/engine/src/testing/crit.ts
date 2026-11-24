/** A hit's crit, from mods, body part and target to tiers. */
import type { BodyPart } from '@abacus/data/schema/effect';

import { NO_VARIABLES } from '@/build/contributions';
import { selectionOf } from '@/build/selectEffects';
import { startOf, totalBuckets } from '@/build/totalBuckets';
import { coldCritEffect } from '@/resolve/crit/coldCrit';
import type { CritLocation } from '@/resolve/crit/hitCrit';
import { hitCrit } from '@/resolve/crit/hitCrit';

import type { Setup } from './stats';
import { equip } from './stats';

type CritSetup = Setup & {
  readonly bodyParts?: readonly BodyPart[];
  readonly location?: CritLocation;
  /** The melee combo multiplier. */
  readonly combo?: number;
  /** The crit damage Cold adds. */
  readonly cold?: number;
};

/** The test rifle's crit, 20% at 2x unless the attack says otherwise. */
export const measureCrit = (setup: CritSetup = {}) => {
  const { bodyParts = [], location = {}, combo = 1, cold = 0 } = setup;
  const { library, rifle, fired, collected, assumptions } = equip(setup);
  const onTarget = coldCritEffect(cold, assumptions);
  const all = { ...collected, effects: [...collected.effects, onTarget] };
  const totals = totalBuckets(all, library, {
    selection: { ...selectionOf(rifle, fired), bodyParts: new Set(bodyParts) },
    moment: { ...startOf(all), variables: { ...NO_VARIABLES, comboTier: combo - 1 } },
  });
  return hitCrit(rifle, fired, { totals, assumptions, ...location });
};

export const attackWith = (critChance: number, critMultiplier = 2) => ({
  critChance,
  critMultiplier,
});
