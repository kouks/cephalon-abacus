import type { DamageType, ProcRef } from '@abacus/data/schema/damageType';

import type { Assumptions } from '@/assumptions';
import type { BuiltAttack } from '@/build/buildAttack';

import type { Roller } from './roller';

/** Where a pellet lands, and what the enemy has that changes the procs it takes. */
export type Rolled = {
  /** Metres to the target: forced procs can have a reach. */
  readonly distance: number;
  /** Tau's status chance vulnerability on the enemy: 0.1 a stack (BIBLE §8). */
  readonly vulnerability?: number;
};

/** The status chance a hit brings, as the enemy takes it: Tau multiplies it, or adds points (T-9). */
export const receivedChance = (
  chance: number,
  vulnerability: number,
  { tauChanceMultiplied }: Pick<Assumptions, 'tauChanceMultiplied'>,
): number => (tauChanceMultiplied ? chance * (1 + vulnerability) : chance + vulnerability);

/** The statuses an attack inflicts whatever its chance, on a target within their reach. */
const forcedAt = ({ attack }: BuiltAttack, distance: number): ReadonlyMap<DamageType, number> =>
  new Map(
    (attack.forcedProcs ?? [])
      .filter(({ within }) => within === undefined || distance <= within)
      .map(({ type, count }) => [type, count]),
  );

const merged = (...counts: readonly ReadonlyMap<DamageType, number>[]): readonly ProcRef[] => {
  const byType = new Map<DamageType, number>();
  for (const [type, count] of counts.flatMap((entry) => [...entry])) {
    byType.set(type, (byType.get(type) ?? 0) + count);
  }
  return [...byType].map(([type, count]) => ({ type, count }));
};

/**
 * One pellet's procs (BIBLE §8): the whole part of its status chance, and one more with the chance of
 * the rest, each of a type picked by its weight; then the forced ones. Above 100%, a type can come up
 * twice. In expected value the counts are shares.
 */
export const rollProcs = (
  built: BuiltAttack,
  { distance, vulnerability = 0 }: Rolled,
  roller: Roller,
) => {
  const chance = receivedChance(built.stats.statusChance.value, vulnerability, built.assumptions);
  const rolled = roller.pick(built.composition.procWeights, roller.count(chance));
  return merged(forcedAt(built, distance), rolled);
};
