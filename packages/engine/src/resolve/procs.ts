import { must } from '@abacus/data/assert';
import type { DamageType } from '@abacus/data/schema/damageType';
import type { Proc } from '@abacus/data/schema/status';

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
const forcedAt = ({ attack }: BuiltAttack, distance: number): ReadonlyMap<string, number> =>
  new Map(
    (attack.forcedProcs ?? [])
      .filter(({ within }) => within === undefined || distance <= within)
      .map(({ status, count }) => [status, count]),
  );

/** Picked types, as the statuses they proc. */
const statusesOf = (
  picked: ReadonlyMap<DamageType, number>,
  { composition }: BuiltAttack,
): ReadonlyMap<string, number> =>
  new Map(
    [...picked].map(([type, count]) => [
      must(composition.procStatuses.get(type), 'procWeights has only types that proc'),
      count,
    ]),
  );

const merged = (...counts: readonly ReadonlyMap<string, number>[]): readonly Proc[] => {
  const byStatus = new Map<string, number>();
  for (const [status, count] of counts.flatMap((entry) => [...entry])) {
    byStatus.set(status, (byStatus.get(status) ?? 0) + count);
  }
  return [...byStatus].map(([status, count]) => ({ status, count }));
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
  return merged(forcedAt(built, distance), statusesOf(rolled, built));
};
