import type { Attack } from '@abacus/data/schema/attack';
import type { BodyPart } from '@abacus/data/schema/effect';

import type { Assumptions } from '@/assumptions';

import type { Composition } from './composition/composeDamage';
import { composeDamage } from './composition/composeDamage';
import type { Moment } from './contributions';
import type { Loadout } from './loadout';
import { selectionOf } from './selectEffects';
import type { AttackRates } from './stats/attackRates';
import { attackRates } from './stats/attackRates';
import type { AttackStats } from './stats/attackStats';
import { attackStats } from './stats/attackStats';
import type { BucketTotals } from './totalBuckets';
import { contributionsTo, startOf, sumBuckets } from './totalBuckets';

/** An attack with the build applied: all that a hit reads of the weapon and its modules. */
export type BuiltAttack = {
  readonly attack: Attack;
  readonly totals: BucketTotals;
  readonly stats: AttackStats;
  readonly rates: AttackRates;
  readonly composition: Composition;
  readonly assumptions: Assumptions;
};

type Where = {
  /** What the part it hits counts as. Some bonuses need a head or a weak point. */
  readonly bodyParts?: readonly BodyPart[];
  readonly moment?: Moment;
};

/** Phase A (BIBLE §3): everything about an attack that doesn't depend on its target. */
export const buildAttack = (loadout: Loadout, attack: Attack, where: Where = {}): BuiltAttack => {
  const { build, library, weapon, collected, assumptions } = loadout;
  const { bodyParts = [], moment = startOf(collected) } = where;
  const selection = { ...selectionOf(weapon, attack), bodyParts: new Set(bodyParts) };
  const contributions = contributionsTo(collected, library, { selection, moment });
  const totals = sumBuckets(contributions, library);
  const stats = attackStats(weapon, attack, { totals, assumptions });
  return {
    attack,
    totals,
    stats,
    rates: attackRates(weapon, attack, stats),
    composition: composeDamage(weapon, attack, {
      build,
      library,
      contributions,
      totals,
      assumptions,
    }),
    assumptions,
  };
};
