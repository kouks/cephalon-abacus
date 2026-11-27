import type { Library } from '@abacus/data/load/library';
import type { Proc } from '@abacus/data/schema/status';

import type { BuiltAttack } from '@/build/buildAttack';
import type { ModdedStat } from '@/build/stats/moddedStat';
import type { LayersLeft } from '@/resolve/applyHit';
import type { TierDealt } from '@/resolve/dealtOnLayers';
import { dealtOnLayers } from '@/resolve/dealtOnLayers';
import type { Defence } from '@/resolve/defence';
import { layerLeft } from '@/resolve/defence';
import type { HitResult } from '@/resolve/resolveHit';
import { resolveHit } from '@/resolve/resolveHit';
import type { Roller } from '@/resolve/roller';
import { withTaken } from '@/resolve/taken';
import type { AimedPart, Target } from '@/resolve/target';

import type { EnemyState } from './enemyState';
import { takenFrom } from './enemyState';
import type { Statuses } from './statuses';
import { addStack } from './statuses';
import type { Capped } from './statusRules';
import { statusRuleOf } from './statusRules';

/** A part aimed at, with the attack built for what it counts as: some bonuses need a weak point. */
export type StruckPart = AimedPart & { readonly built: BuiltAttack };

/** An attack's pellets on the parts aimed at: a direct hit, or its explosion. */
export type Strike = {
  /** What doesn't depend on the part: its pellets, and how long its procs last. */
  readonly built: BuiltAttack;
  readonly parts: readonly StruckPart[];
  readonly distance: number;
  /** How far the shot goes that sets this attack off. Absent: the attack is the shot. */
  readonly reach?: ModdedStat | undefined;
  /** Metres from the target that the shot lands. Absent: it hits. */
  readonly missBy?: number | undefined;
};

/** The enemy as the library and the scenario have it, and how the hits are rolled. */
export type Fight = {
  readonly target: Target;
  readonly defence: Defence;
  readonly library: Library;
  readonly enemy: Capped;
  readonly roller: Roller;
};

/** One pellet's hit on one part: how much of it there is (a share in expected value), and its outcome. */
export type PelletHit = {
  readonly pellet: number;
  readonly amount: number;
  readonly hit: HitResult;
  readonly dealt: readonly TierDealt[];
  /** The attack as built for the part, without the statuses on the enemy, which its procs' ticks read. */
  readonly built: BuiltAttack;
};

/** Which pellet of the pull, and how much of one: 1, or a share of the last in expected value. */
export type Pellet = { readonly index: number; readonly weight: number };

type Outcome = {
  readonly hits: readonly PelletHit[];
  /** What is left after each outcome, with how much of the pellet it is. */
  readonly left: readonly (readonly [number, LayersLeft])[];
};

type Struck = { readonly pellet: Pellet; readonly fight: Fight };

/** The pellet on each part it lands on, and the crit tier it shows there, as the roller picks them. */
const landed = (state: EnemyState, strike: Strike, { pellet, fight }: Struck): Outcome => {
  const { roller, target } = fight;
  const defence = { ...fight.defence, left: state.left, layer: layerLeft(state.left) };
  const taken = takenFrom(state, fight.library);
  const parts = roller.pick(
    new Map(strike.parts.map((struck) => [struck, struck.share])),
    pellet.weight,
  );
  const { distance, reach, missBy } = strike;
  const outcomes = [...parts].map(([{ part, built: forPart }, amount]): Outcome => {
    const built = withTaken(forPart, taken);
    const at = { target, part, distance, reach, missBy };
    const hit = resolveHit(built, { ...at, defence, roller });
    const dealt = dealtOnLayers(built, at, defence);
    const tiers = roller.pick(new Map(dealt.map((tier) => [tier, tier.chance])), amount);
    const trace = { ...hit.trace, t: state.at, pellet: pellet.index };
    return {
      hits: [{ pellet: pellet.index, amount, hit: { ...hit, trace }, dealt, built: forPart }],
      left: [...tiers].map(([tier, share]) => [share, tier.left] as const),
    };
  });
  return { hits: outcomes.flatMap(({ hits }) => hits), left: outcomes.flatMap(({ left }) => left) };
};

/**
 * What is left after a pellet or a tick: its outcomes mixed by share, and the rest of it as none. All
 * of it lands on the neutral dummy's endless health, which a share of none would make 0 × ∞.
 */
export const leftAfter = (left: LayersLeft, outcomes: Outcome['left']): LayersLeft => {
  const missed = 1 - outcomes.reduce((sum, [share]) => sum + share, 0);
  const unhit = (layer: keyof LayersLeft) => (missed > 0 ? missed * left[layer] : 0);
  const mix = (layer: keyof LayersLeft) =>
    outcomes.reduce((sum, [share, after]) => sum + share * after[layer], unhit(layer));
  return { overguard: mix('overguard'), shield: mix('shield'), health: mix('health') };
};

type Landed = { readonly hits: readonly PelletHit[]; readonly strike: Strike };

/** The statuses after the pellet: each hit's procs, as shares of it, under the enemy's caps. */
const procsAdded = (state: EnemyState, { hits, strike }: Landed, fight: Fight): Statuses => {
  const enemy = { ...fight.enemy, hasOverguard: state.left.overguard > 0 };
  const scale = strike.built.stats.statusDuration.value;
  const procs = hits.flatMap(({ hit, amount }) =>
    hit.trace.procs.map((proc): readonly [Proc, number] => [proc, amount]),
  );
  return procs.reduce((statuses, [{ status, count }, amount]) => {
    const rule = statusRuleOf(status, fight.library, enemy);
    const duration = (rule.status.duration ?? Number.POSITIVE_INFINITY) * scale;
    return addStack(statuses, { status, at: state.at, amount: count * amount, duration }, rule);
  }, state.statuses);
};

/**
 * One pellet against the enemy as it is (BIBLE §3): it reads what is left of each layer and the
 * statuses on it, and writes back what it applied and the procs it added. In expected value it is a
 * mix of every part and crit tier it can land on; drawn, the roller picks one of each.
 */
export const strikePellet = (state: EnemyState, strike: Strike, struck: Struck) => {
  const { hits, left } = landed(state, strike, struck);
  const statuses = procsAdded(state, { hits, strike }, struck.fight);
  return { state: { ...state, left: leftAfter(state.left, left), statuses }, hits };
};
