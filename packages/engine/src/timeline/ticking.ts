import type { BuiltAttack } from '@/build/buildAttack';
import type { DotRule } from '@/build/dotRules';
import { attackerSide } from '@/resolve/dot/tick';
import type { Target } from '@/resolve/target';
import type { Factor, HitTrace } from '@/trace/hitTrace';

import type { PelletHit } from './pellet';

/** A DoT proc on the enemy: what its ticks need, and when those after the next one land (BIBLE §8). */
export type Ticking = {
  readonly dot: DotRule;
  /**
   * The attack as built for the part the hit struck, without the statuses on the enemy: each tick
   * reads those as they are when it lands.
   */
  readonly built: BuiltAttack;
  readonly tier: number;
  readonly seed: number;
  /** How much of a proc it is: as much of a pellet as the hit, its share of a proc, its tier's chance. */
  readonly share: number;
  /** The attacker's side of every tick, which the proc keeps from the hit. */
  readonly attacker: readonly Factor[];
  /** When the ticks after the next one land, in simulated seconds. */
  readonly later: readonly number[];
};

/** The next tick of a DoT proc. */
export type ProcTick = { readonly kind: 'procTick'; readonly at: number; readonly proc: Ticking };

type Landing = { readonly at: number; readonly target: Target };

/** What of a hit its procs need: the attack as built for the part, its share, and its DoT procs. */
type Inflicting = Pick<PelletHit, 'built' | 'amount'> & {
  readonly hit: { readonly trace: Pick<HitTrace, 'dots'> };
};

/** A proc's next tick, if it has one left. */
export const nextTick = (proc: Ticking, times: readonly number[]): readonly ProcTick[] => {
  const [at, ...later] = times;
  return at === undefined ? [] : [{ kind: 'procTick', at, proc: { ...proc, later } }];
};

/** The first tick of each DoT proc a hit inflicts, of each crit tier it can be of. */
export const firstTicks = (
  { built, amount, hit }: Inflicting,
  { at, target }: Landing,
): readonly ProcTick[] =>
  hit.trace.dots.flatMap(({ status, count, tier, chance, seed, times }) => {
    const dot = built.dots.get(status);
    const share = amount * count * chance;
    if (dot === undefined || share <= 0) return [];
    const attacker = attackerSide(dot, seed, { procTotals: built.procTotals, target });
    const proc = { dot, built, tier, seed, share, attacker, later: [] };
    return nextTick(
      proc,
      times.map((time) => at + time),
    );
  });
