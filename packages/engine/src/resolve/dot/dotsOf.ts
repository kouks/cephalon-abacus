import type { Proc } from '@abacus/data/schema/status';

import type { BuiltAttack } from '@/build/buildAttack';
import { tierMultiplier } from '@/resolve/crit/critTiers';
import type { HitCrit } from '@/resolve/crit/hitCrit';
import type { Met } from '@/resolve/factors/layerFactors';
import type { Target } from '@/resolve/target';
import type { DotTrace, Factor } from '@/trace/hitTrace';

import { seedOf } from './seed';
import { tickOf } from './tick';
import { tickTimes } from './tickTimes';

/** What a hit leaves its procs: the procs, its crit, its chain of factors, and what it met. */
type Inflicted = {
  readonly procs: readonly Proc[];
  readonly crit: HitCrit;
  readonly chain: readonly Factor[];
  readonly met: Met | undefined;
  readonly target: Target;
};

/**
 * Each DoT proc the hit inflicts, once for each crit tier it can be of (BIBLE §8): its seed carries
 * the tier's multiplier, as the game's crit DoTs do (the wiki's Damage/Calculation page).
 */
export const dotsOf = (built: BuiltAttack, inflicted: Inflicted): readonly DotTrace[] => {
  const { procs, crit, chain, met, target } = inflicted;
  const { procTotals, totals, assumptions, stats } = built;
  const seed = seedOf(chain);
  const context = { procTotals, totals, target, met };
  return procs.flatMap(({ status, count }) => {
    const dot = built.dots.get(status);
    if (dot === undefined) return [];
    const times = tickTimes(dot, stats.statusDuration.value, assumptions);
    return crit.tiers.map(({ tier, chance }): DotTrace => {
      const tierSeed = seed * tierMultiplier(tier, crit.multiplier.value);
      return {
        status,
        count,
        tier,
        chance,
        seed: tierSeed,
        times,
        ...tickOf(dot, tierSeed, context),
      };
    });
  });
};
