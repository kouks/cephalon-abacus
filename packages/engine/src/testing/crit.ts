/** A hit's crit, from mods, body part and target to tiers. */
import type { BodyPart } from '@abacus/data/schema/effect';

import { NO_VARIABLES } from '@/build/contributions';
import { selectionOf } from '@/build/selectEffects';
import { startOf, totalBuckets } from '@/build/totalBuckets';
import type { CritLocation } from '@/resolve/crit/hitCrit';
import { hitCrit } from '@/resolve/crit/hitCrit';
import { totalsWithTaken } from '@/resolve/taken';
import { takenOfStacks } from '@/timeline/enemyState';

import type { Setup } from './stats';
import { equip } from './stats';

type CritSetup = Setup & {
  readonly bodyParts?: readonly BodyPart[];
  readonly location?: CritLocation;
  /** The melee combo multiplier. */
  readonly combo?: number;
  /** Cold's stacks on the target. */
  readonly coldStacks?: number;
};

/** The test rifle's crit, 20% at 2x unless the attack says otherwise. */
export const measureCrit = (setup: CritSetup = {}) => {
  const { bodyParts = [], location = {}, combo = 1, coldStacks = 0 } = setup;
  const { library, rifle, fired, collected, assumptions } = equip(setup);
  const selection = { ...selectionOf(rifle, fired), bodyParts: new Set(bodyParts) };
  const modded = totalBuckets(collected, library, {
    selection,
    moment: { ...startOf(collected), variables: { ...NO_VARIABLES, comboTier: combo - 1 } },
  });
  const onTarget = takenOfStacks([['freeze', coldStacks]], library);
  const totals = totalsWithTaken(modded, onTarget, { scope: selection.scope, assumptions });
  return hitCrit(fired, { totals, assumptions, ...location });
};

export const attackWith = (critChance: number, critMultiplier = 2) => ({
  critChance,
  critMultiplier,
});
