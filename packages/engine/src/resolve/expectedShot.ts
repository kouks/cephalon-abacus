import type { DamageType } from '@abacus/data/schema/damageType';
import type { BodyPart } from '@abacus/data/schema/effect';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { BuiltAttack } from '@/build/buildAttack';

import type { HitResult } from './resolveHit';
import { resolveHit } from './resolveHit';
import type { AimedPart, Target } from './target';
import { aimAt, bodyOf } from './target';

/** One shot on average: its pellets, and where they land. */
export type ExpectedShot = {
  readonly pellets: number;
  /** One pellet on each part aimed at, and how many of the pellets hit it. */
  readonly hits: readonly { readonly share: number; readonly hit: HitResult }[];
  readonly perType: ReadonlyMap<DamageType, number>;
  readonly total: number;
};

type Shot = {
  /** Builds the attack for a part that counts as these. */
  readonly buildFor: (bodyParts: readonly BodyPart[]) => BuiltAttack;
  readonly target: Target;
  readonly aim: Scenario['aim'];
};

/** An attack that can't headshot hits the body, wherever it is aimed: most AoE. */
const partsHit = ({ buildFor, target, aim }: Shot): readonly AimedPart[] =>
  buildFor([]).attack.flags?.includes('canHeadshot') === true
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
  const pellets = Math.max(shot.buildFor([]).stats.multishot.value, 0);
  const hits = partsHit(shot).map(({ part, share }) => {
    const built = shot.buildFor(part.bodyParts);
    return { share, hit: resolveHit(built, { target: shot.target, part }) };
  });
  const perType = addUp(hits, pellets);
  const total = [...perType.values()].reduce((sum, damage) => sum + damage, 0);
  return { pellets, hits, perType, total };
};
