import type { Library } from '@abacus/data/load/library';
import type { Attack } from '@abacus/data/schema/attack';
import type { DamageType } from '@abacus/data/schema/damageType';
import type { Scenario } from '@abacus/data/schema/scenario';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Assumptions } from '@/assumptions';
import { aggregate } from '@/build/aggregate';
import { combineElements } from '@/build/elements/combineElements';
import type { FinalElement } from '@/build/elements/types';
import type { ModdedStat } from '@/build/stats/moddedStat';
import { memberTotal, totalIn } from '@/build/stats/moddedStat';
import type { BucketTotals } from '@/build/totalBuckets';
import type { Contribution } from '@/build/types';

import type { BaseDamage } from './baseDamage';
import { baseDamage, progenitorOf } from './baseDamage';
import { elementSources } from './elementSources';
import { quantize } from './quantize';

/** One damage type of a hit, as shares of total base damage and as damage. */
export type TypeDamage = {
  /** Before quantization, as the arsenal shows it. */
  readonly ratio: number;
  readonly quantized: number;
  /** quantized × modded base damage, before anything the target does. */
  readonly damage: number;
  /** The physical or elemental bonuses behind it. */
  readonly effects: readonly Contribution[];
};

type ByType<Value> = ReadonlyMap<DamageType, Value>;

/** The damage of one hit by type, and how it came about (BIBLE §6). */
export type Composition = {
  /** Total base damage × (1 + damage.base). Statuses scale with this, unquantized. */
  readonly moddedBase: ModdedStat;
  readonly types: ByType<TypeDamage>;
  /** Each physical type's share of base damage, and its bonuses. */
  readonly physical: ByType<ModdedStat>;
  /** Each element, and the bonuses that formed it. */
  readonly elements: readonly FinalElement[];
  /** How likely a proc is to be of each type, relative to the others. */
  readonly procWeights: ByType<number>;
  /** The status each type in procWeights procs, by its id in statuses.json. */
  readonly procStatuses: ByType<string>;
};

type Context = {
  readonly build: Scenario['build'];
  readonly library: Library;
  readonly contributions: readonly Contribution[];
  readonly totals: BucketTotals;
  readonly assumptions: Assumptions;
};

/**
 * Physical bonuses scale what the attack has: +Slash does nothing for one without Slash. A type they
 * take below zero is gone.
 */
const physicalShares = (
  { total, parts }: BaseDamage,
  { library, totals }: Context,
): ByType<ModdedStat> => {
  const shares = new Map<DamageType, number>();
  for (const { type, amount } of parts) {
    if (library.damageTypes.get(type)?.group !== 'physical') continue;
    shares.set(type, (shares.get(type) ?? 0) + amount / total);
  }
  return new Map(
    [...shares].map(([type, base]) => {
      const bonus = memberTotal(totals, `damage.ips.${type}`);
      return [type, { base, value: Math.max(aggregate(bonus, base), 0), totals: [bonus] }];
    }),
  );
};

const physicalTypes = (physical: ByType<ModdedStat>) =>
  [...physical].map(([type, { value, totals }]) => {
    return { type, ratio: value, effects: totals.flatMap(({ contributions }) => contributions) };
  });

const elementalType = ({ element, ratio, parts }: FinalElement) => {
  const sources = parts.flatMap((part) => part.sources);
  return { type: element, ratio, effects: sources.flatMap((source) => source.contribution ?? []) };
};

const modBase = (base: number, totals: BucketTotals): ModdedStat => {
  const bonus = totalIn(totals, 'damage.base');
  return { base, value: Math.max(aggregate(bonus, base), 0), totals: [bonus] };
};

/** The status each type procs. A type that procs none is out of the pool, as an immune one is. */
const statusesOf = (types: ByType<TypeDamage>, { damageTypes }: Library): ByType<string> =>
  new Map(
    [...types.keys()].flatMap((type) => {
      const status = damageTypes.get(type)?.proc;
      return status === undefined ? [] : [[type, status] as const];
    }),
  );

/** A type quantized to zero can't proc (T-14). */
const weigh = (
  types: ByType<TypeDamage>,
  statuses: ByType<string>,
  { procWeightsQuantized }: Assumptions,
) =>
  new Map(
    [...types]
      .filter(([type]) => statuses.has(type))
      .map(
        ([type, { ratio, quantized }]) => [type, procWeightsQuantized ? quantized : ratio] as const,
      )
      .filter(([, weight]) => weight > 0),
  );

/** Base damage, its physical and elemental bonuses, quantized, times damage bonuses (BIBLE §6). */
export const composeDamage = (weapon: Weapon, attack: Attack, context: Context): Composition => {
  const base = baseDamage(attack, progenitorOf(weapon, context.build));
  const moddedBase = modBase(base.total, context.totals);
  const physical = physicalShares(base, context);
  const { explanation: elements } = combineElements(
    elementSources(weapon, base, context),
    context.library.damageTypes,
  );

  const shares = [...physicalTypes(physical), ...elements.map(elementalType)];
  const types = new Map(
    shares.map(({ type, ratio, effects }) => {
      const quantized = quantize(ratio);
      return [type, { ratio, quantized, damage: quantized * moddedBase.value, effects }];
    }),
  );
  const procStatuses = statusesOf(types, context.library);
  const procWeights = weigh(types, procStatuses, context.assumptions);
  return { moddedBase, types, physical, elements, procWeights, procStatuses };
};
