import { must } from '@abacus/data/assert';
import type { Layer } from '@abacus/data/schema/damageTypeRule';
import { LAYERS } from '@abacus/data/schema/damageTypeRule';

import type { Assumptions } from '@/assumptions';
import { aggregate, joinTotals } from '@/build/aggregate';
import type { DotRule } from '@/build/dotRules';
import { memberTotal } from '@/build/stats/moddedStat';
import type { BucketTotals } from '@/build/totalBuckets';
import type { Defence } from '@/resolve/defence';
import { amplifierFactor } from '@/resolve/factors/amplifierFactor';
import { factionFactor } from '@/resolve/factors/bonusFactors';
import { effectsOf, factor } from '@/resolve/factors/factor';
import type { Met } from '@/resolve/factors/layerFactors';
import { layerFactors } from '@/resolve/factors/layerFactors';
import { reductionFactor } from '@/resolve/factors/reductionFactor';
import { vulnerabilityFactors } from '@/resolve/factors/typeFactors';
import type { Target } from '@/resolve/target';
import type { Factor } from '@/trace/hitTrace';

/** What a tick reads: the build's bonuses for procs, the hit's totals with what the enemy takes, and the enemy. */
export type TickContext = {
  readonly procTotals: BucketTotals;
  readonly totals: BucketTotals;
  readonly target: Target;
  readonly met: Met | undefined;
  readonly assumptions: Assumptions;
};

const elementFactor = (procTotals: BucketTotals, { elements }: DotRule): Factor => {
  const [first, ...rest] = elements.map((type) =>
    memberTotal(procTotals, `damage.element.${type}`),
  );
  if (first === undefined) return factor('element', 1);
  const bonus = joinTotals(first, ...rest);
  return factor('element', aggregate(bonus, 1), effectsOf([bonus]));
};

const statusDamageFactor = (procTotals: BucketTotals): Factor => {
  const total = memberTotal(procTotals, 'status.damage');
  return factor('statusDamage', aggregate(total, 1), total.contributions);
};

/** (seed + 1) × c × (1 + element) × (1 + faction) × (1 + status damage): faction a second time. */
const attackerSide = (dot: DotRule, seed: number, context: TickContext): readonly Factor[] => [
  factor('seed', seed + 1),
  factor('coefficient', dot.coefficient),
  elementFactor(context.procTotals, dot),
  factionFactor(context.procTotals, context.target),
  statusDamageFactor(context.procTotals),
];

/** The first layer from the one the hit met that the tick's type damages: Toxin's skips shields. */
const tickLayer = (dot: DotRule, { layer, rules }: Defence): Layer =>
  must(
    LAYERS.slice(LAYERS.indexOf(layer)).find(
      (each) => rules.get(dot.dealsAs)?.layers[each] !== undefined,
    ),
    'Every type that ticks damages health',
  );

const vulnerabilityOf = (dot: DotRule, { target, assumptions }: TickContext): Factor => {
  const [weakness] =
    assumptions.dotsTakeTypeWeakness && dot.procType !== undefined
      ? vulnerabilityFactors([dot.procType], target)
      : [];
  return factor('vulnerability', weakness?.value ?? 1, weakness?.effects);
};

/** The enemy's side: the faction's weakness (T-8), the layer, armor, Viral or Magnetic, and reductions. */
const targetSide = (dot: DotRule, context: TickContext): readonly Factor[] => {
  const { met, totals } = context;
  const at =
    met === undefined
      ? undefined
      : { ...met, defence: { ...met.defence, layer: tickLayer(dot, met.defence) } };
  return [
    vulnerabilityOf(dot, context),
    ...layerFactors([dot.dealsAs], at),
    amplifierFactor(totals, at),
    reductionFactor(totals),
  ];
};

/** In binary32, step by step, as the game works the attacker's side (the wiki's Damage/Calculation page). */
const f32Product = (factors: readonly Factor[]) =>
  factors.reduce((product, { value }) => Math.fround(product * Math.fround(value)), 1);

const product = (factors: readonly Factor[]) =>
  factors.reduce((total, { value }) => total * value, 1);

/** One tick of a DoT proc with this seed, and every factor that made it (BIBLE §8). */
export const tickOf = (dot: DotRule, seed: number, context: TickContext) => {
  const attacker = attackerSide(dot, seed, context);
  const target = targetSide(dot, context);
  return { factors: [...attacker, ...target], damage: f32Product(attacker) * product(target) };
};
