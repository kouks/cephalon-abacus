import type { DamageType } from '@abacus/data/schema/damageType';

import type { BuiltAttack } from '@/build/buildAttack';
import type { ModdedStat } from '@/build/stats/moddedStat';
import type { Factor, HitTrace } from '@/trace/hitTrace';

import type { TierChance } from './crit/critTiers';
import { tierMultiplier } from './crit/critTiers';
import type { HitCrit } from './crit/hitCrit';
import { hitCrit } from './crit/hitCrit';
import { bodyPartFactor } from './factors/bodyPartFactor';
import { factionFactor, finalFactors } from './factors/bonusFactors';
import { effectsOf, factor } from './factors/factor';
import { falloffFactor } from './factors/falloffFactor';
import { landingFactor } from './factors/landingFactor';
import { radialFalloffFactor } from './factors/radialFalloffFactor';
import { rangeFactor } from './factors/rangeFactor';
import { damageFactors, layerFactors, vulnerabilityFactors } from './factors/typeFactors';
import type { Target, TargetPart } from './target';

export type HitResult = {
  readonly perType: ReadonlyMap<DamageType, number>;
  readonly total: number;
  readonly crit: HitCrit;
  /** The number each crit tier shows: white, yellow, orange… */
  readonly tiers: readonly (TierChance & { readonly total: number })[];
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
};

const critFactor = ({ chance, multiplier, expected }: HitCrit) =>
  factor('crit', expected, effectsOf([...chance.totals, ...multiplier.totals]));

/** The direct-damage chain, in the order of BIBLE §3. */
const chainOf = (
  built: BuiltAttack,
  { target, part, distance, reach = built.stats.range, missBy = 0 }: At,
  crit: HitCrit,
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
  ...layerFactors(),
];

const damageOf = (type: DamageType, factors: readonly Factor[]) =>
  factors
    .filter((entry) => entry.type === undefined || entry.type === type)
    .reduce((product, { value }) => product * value, 1);

const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

/** Phase B (BIBLE §3): one hit on one part of a target, with the mean of its crit tiers. */
export const resolveHit = (built: BuiltAttack, at: At): HitResult => {
  const { attack, totals, assumptions, composition } = built;
  const crit = hitCrit(attack, { ...at.part, totals, assumptions });
  const factors = chainOf(built, at, crit);
  const types = [...composition.types.keys()];
  const perType = new Map(types.map((type) => [type, damageOf(type, factors)]));

  const withoutCrit = factors.filter(({ name }) => name !== 'crit');
  const white = sum(types.map((type) => damageOf(type, withoutCrit)));
  const tiers = crit.tiers.map(({ tier, chance }) => {
    return { tier, chance, total: white * tierMultiplier(tier, crit.multiplier.value) };
  });
  const trace = { t: 0, pellet: 0, factors, perType, layer: 'health', procs: [] } as const;
  return { perType, total: sum(perType.values()), crit, tiers, trace };
};
