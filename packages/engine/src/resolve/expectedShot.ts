import type { DamageType } from '@abacus/data/schema/damageType';
import type { BodyPart } from '@abacus/data/schema/effect';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { BuiltAttack } from '@/build/buildAttack';
import type { AttackStats } from '@/build/stats/attackStats';
import type { ModdedStat } from '@/build/stats/moddedStat';

import type { TierDealt } from './dealtOnLayers';
import { dealtOnLayers } from './dealtOnLayers';
import type { Defence } from './defence';
import { dotDamageOf } from './dot/dotDamage';

import type { HitResult } from './resolveHit';
import { resolveHit } from './resolveHit';
import type { AimedPart, Target } from './target';
import { aimAt, bodyOf } from './target';

/** One shot on average: its pellets, and where they land. */
export type ExpectedShot = {
  readonly stats: AttackStats;
  readonly pellets: number;
  /**
   * One pellet on each part aimed at, how many of the pellets hit it, and what one of each crit tier
   * shows and applies on the enemy's layers as they are (empty without a defence).
   */
  readonly hits: readonly {
    readonly share: number;
    readonly hit: HitResult;
    readonly dealt: readonly TierDealt[];
  }[];
  readonly perType: ReadonlyMap<DamageType, number>;
  readonly total: number;
  /** What its procs deal over time, apart from the total (BIBLE §8). */
  readonly dot: number;
};

type Shot = {
  /** Builds the attack for a part that counts as these. */
  readonly buildFor: (bodyParts: readonly BodyPart[]) => BuiltAttack;
  readonly target: Target;
  readonly aim: Scenario['aim'];
  readonly distance: number;
  readonly reach?: ModdedStat | undefined;
  readonly defence?: Defence | undefined;
};

/** An attack that can't headshot hits the body, wherever it is aimed: most AoE. */
const partsHit = ({ attack }: BuiltAttack, { target, aim }: Shot): readonly AimedPart[] =>
  attack.flags?.includes('canHeadshot') === true
    ? aimAt(aim, target)
    : [{ part: bodyOf(target), share: 1 }];

const addUp = (hits: ExpectedShot['hits'], pellets: number) => {
  const perType = new Map<DamageType, number>();
  for (const { share, hit } of hits) {
    for (const [type, damage] of hit.perType) {
      perType.set(type, (perType.get(type) ?? 0) + pellets * share * damage);
    }
  }
  return perType;
};

export const expectedShot = (shot: Shot): ExpectedShot => {
  const { target, distance, reach, aim, buildFor, defence } = shot;
  const built = buildFor([]);
  const { stats } = built;
  const pellets = Math.max(stats.multishot.value, 0);
  const hits = partsHit(built, shot).map(({ part, share }) => {
    const at = { target, part, distance, reach, missBy: aim.missBy };
    const built = buildFor(part.bodyParts);
    const dealt = defence === undefined ? [] : dealtOnLayers(built, at, defence);
    return { share, hit: resolveHit(built, { ...at, defence }), dealt };
  });
  const perType = addUp(hits, pellets);
  const total = [...perType.values()].reduce((sum, damage) => sum + damage, 0);
  const dot = hits.reduce(
    (sum, { share, hit }) => sum + pellets * share * dotDamageOf(hit.trace),
    0,
  );
  return { stats, pellets, hits, perType, total, dot };
};
