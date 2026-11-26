import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { BodyPart } from '@abacus/data/schema/effect';
import type { EnemyPart } from '@abacus/data/schema/enemy';
import type { Faction } from '@abacus/data/schema/faction';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { TierRaise } from './crit/critTiers';
import type { CritLocation } from './crit/hitCrit';

/** A part of a target: its multiplier, and what it counts as (BIBLE §11). */
export type TargetPart = CritLocation & {
  readonly multiplier: number;
  readonly bodyParts: readonly BodyPart[];
};

export type Target = {
  readonly id: string;
  readonly name: string;
  /** Absent: nothing is strong or weak against it. */
  readonly faction?: Faction;
  readonly parts: ReadonlyMap<string, TargetPart>;
};

const BODY: TargetPart = { multiplier: 1, bodyParts: [] };

/** Most humanoids: 3x, and a headcrit doubles the crit multiplier. */
const STANDARD_PARTS: Target['parts'] = new Map([
  ['body', BODY],
  ['head', { multiplier: 3, bodyParts: ['head', 'weakPoint'], headcrit: 2 }],
]);

/** No armor, shields, Overguard or faction weaknesses. */
const NEUTRAL_DUMMY: Target = {
  id: 'neutral-dummy',
  name: 'Neutral dummy',
  parts: STANDARD_PARTS,
};

/** Targets that are not in the library. */
const BUILT_IN: ReadonlyMap<string, Target> = new Map([[NEUTRAL_DUMMY.id, NEUTRAL_DUMMY]]);

/** Every hit, white ones too, is of one tier more. */
const PROMOTION: TierRaise = { chance: 1, from: 0 };

const partOf = ({ multiplier, countsAs = [], headcrit, promotes }: EnemyPart): TargetPart => ({
  multiplier,
  bodyParts: countsAs,
  ...(headcrit === undefined ? {} : { headcrit }),
  ...(promotes === undefined ? {} : { raises: [PROMOTION] }),
});

export const findTarget = (id: string, { enemies, factions }: Library): Target => {
  const enemy = enemies.get(id);
  if (enemy === undefined) return must(BUILT_IN.get(id), `No enemy "${id}"`);
  const faction = must(factions.get(enemy.faction), 'The loader checks factions');
  const parts = new Map(enemy.bodyParts.map((part) => [part.id, partOf(part)]));
  return { id, name: enemy.name, faction, parts };
};

export const bodyOf = ({ parts }: Target): TargetPart => parts.get('body') ?? BODY;

export type AimedPart = { readonly part: TargetPart; readonly share: number };

/** The parts hit, with the share of hits on each. A part the target lacks counts as its body. */
export const aimAt = (
  { head, body, weakPoint = 'head' }: Scenario['aim'],
  target: Target,
): readonly AimedPart[] =>
  [
    { part: target.parts.get(weakPoint) ?? bodyOf(target), share: head },
    { part: bodyOf(target), share: body },
  ].filter(({ share }) => share > 0);
