import type { DamageType } from '@abacus/data/schema/damageType';

import type { BuiltAttack } from '@/build/buildAttack';
import type { ModdedStat } from '@/build/stats/moddedStat';
import type { Factor, HitTrace } from '@/trace/hitTrace';

import type { TierChance } from './crit/critTiers';
import type { HitCrit } from './crit/hitCrit';
import { hitCrit } from './crit/hitCrit';
import { amplifierFactor } from './factors/amplifierFactor';
import { bodyPartFactor } from './factors/bodyPartFactor';
import { factionFactor, finalFactors } from './factors/bonusFactors';
import { effectsOf, factor } from './factors/factor';
import { falloffFactor } from './factors/falloffFactor';
import { landingFactor } from './factors/landingFactor';
import { radialFalloffFactor } from './factors/radialFalloffFactor';
import { rangeFactor, reachesTarget } from './factors/rangeFactor';
import type { Met } from './factors/layerFactors';
import { layerFactors } from './factors/layerFactors';
import { reductionFactor } from './factors/reductionFactor';
import { damageFactors, vulnerabilityFactors } from './factors/typeFactors';
import type { TypeDamage } from './leastDamage';
import { leastFactors, tierTypes } from './leastDamage';
import type { Defence } from './defence';
import { dotsOf } from './dot/dotsOf';
import { rollProcs } from './procs';
import type { Roller } from './roller';
import { EXPECTED_ROLLER } from './roller';
import { armorMet } from './strips';
import type { Target, TargetPart } from './target';

export type HitResult = {
  readonly perType: ReadonlyMap<DamageType, number>;
  readonly total: number;
  readonly crit: HitCrit;
  /** The number each crit tier shows: white, yellow, orange… and its damage by type. */
  readonly tiers: readonly (TierChance & {
    readonly total: number;
    readonly perType: ReadonlyMap<DamageType, number>;
  })[];
  readonly trace: HitTrace;
};

type At = {
  readonly target: Target;
  readonly part: TargetPart;
  /** Metres to the target. */
  readonly distance: number;
  /** How far the shot goes that sets this attack off. Absent: the attack is the shot. */
  readonly reach?: ModdedStat | undefined;
  /** Metres from the target that the shot lands. Absent: it hits. */
  readonly missBy?: number | undefined;
  /** The layer it meets, and the armor. Absent: bare health, as on the neutral dummy. */
  readonly defence?: Defence | undefined;
  /** How the procs are rolled. Absent: in expected value. */
  readonly roller?: Roller | undefined;
};

const critFactor = ({ chance, multiplier, expected }: HitCrit) =>
  factor('crit', expected, effectsOf([...chance.totals, ...multiplier.totals]));

/** The direct-damage chain, in the order of BIBLE §3, up to the least of 1 that armor leaves. */
const chainOf = (
  built: BuiltAttack,
  { target, part, distance, reach = built.stats.range, missBy = 0 }: At,
  { crit, met }: { readonly crit: HitCrit; readonly met: Met | undefined },
): readonly Factor[] => [
  ...damageFactors(built.composition),
  factionFactor(built.totals, target),
  ...finalFactors(built.totals),
  critFactor(crit),
  bodyPartFactor(built.totals, part),
  rangeFactor(reach, distance),
  falloffFactor(built, distance),
  landingFactor(built, missBy),
  radialFalloffFactor(built, missBy),
  ...vulnerabilityFactors(built.composition.types.keys(), target),
  ...layerFactors(built.composition.types.keys(), met),
  amplifierFactor(built.totals, met),
];

const damageOf = (type: DamageType, factors: readonly Factor[]) =>
  factors
    .filter((entry) => entry.type === undefined || entry.type === type)
    .reduce((product, { value }) => product * value, 1);

const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

/** Each type before crits, and whether armor reduced it. */
const typesOf = (types: readonly DamageType[], chain: readonly Factor[]): readonly TypeDamage[] => {
  const withoutCrit = chain.filter(({ name }) => name !== 'crit');
  return types.map((type) => ({
    type,
    white: damageOf(type, withoutCrit),
    isArmored: chain.some(
      (entry) => entry.name === 'armor' && entry.type === type && entry.value < 1,
    ),
  }));
};

const reduced = (byType: ReadonlyMap<DamageType, number>, by: number) =>
  new Map([...byType].map(([type, damage]) => [type, damage * by]));

type Traced = Pick<HitTrace, 'factors' | 'perType' | 'procs' | 'dots'> & {
  readonly met: Met | undefined;
};

/** The layer the hit met, and the armor on it after strips. */
const traceOf = ({ factors, perType, procs, dots, met }: Traced): HitTrace => {
  const trace = {
    t: 0,
    pellet: 0,
    factors,
    perType,
    layer: met?.defence.layer ?? 'health',
    procs,
    dots,
  };
  return met === undefined ? trace : { ...trace, armor: met.armor.value };
};

/** Phase B (BIBLE §3): one hit on one part of a target, with the mean of its crit tiers. */
export const resolveHit = (built: BuiltAttack, at: At): HitResult => {
  const { attack, totals, assumptions, composition } = built;
  const crit = hitCrit(attack, { ...at.part, totals, assumptions });
  const met =
    at.defence === undefined
      ? undefined
      : { defence: at.defence, armor: armorMet(at.defence, built) };
  const chain = chainOf(built, at, { crit, met });
  const types = typesOf([...composition.types.keys()], chain);
  const multiplier = crit.multiplier.value;
  const reduction = reductionFactor(totals);
  const least = leastFactors(types, { tiers: crit.tiers, multiplier });
  const factors = [...chain, ...least, reduction];
  const perType = new Map(types.map(({ type }) => [type, damageOf(type, factors)]));
  const tiers = crit.tiers.map(({ tier, chance }) => {
    const byType = reduced(tierTypes(types, tier, multiplier), reduction.value);
    return { tier, chance, total: sum(byType.values()), perType: byType };
  });
  const roller = at.roller ?? EXPECTED_ROLLER;
  const procs = reachesTarget(chain) ? rollProcs(built, at.distance, roller) : [];
  const dots = dotsOf(built, { procs, crit, chain, met, target: at.target });
  const trace = traceOf({ factors, perType, procs, dots, met });
  return { perType, total: sum(perType.values()), crit, tiers, trace };
};
