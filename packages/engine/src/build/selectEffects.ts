import { findBucket } from '@abacus/data/load/findBucket';
import type { Reference } from '@abacus/data/load/library';
import type { Attack } from '@abacus/data/schema/attack';
import type { Bucket } from '@abacus/data/schema/bucket';
import type { DamageType } from '@abacus/data/schema/damageType';
import type { BodyPart, Scope } from '@abacus/data/schema/effect';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { CollectedEffect } from './types';

/** What a number is being worked out for. Effects whose filters don't match it are left out. */
export type Selection = {
  readonly scope: Scope;
  readonly attackTags: ReadonlySet<string>;
  readonly bodyParts?: ReadonlySet<BodyPart>;
  readonly damageType?: DamageType;
};

/** What `filter.attackTags` can name: the attack's trigger, shot type and flags, and the weapon's tags. */
export const attackTagsOf = ({ compatTags = [] }: Weapon, attack: Attack): ReadonlySet<string> =>
  new Set([attack.trigger, attack.shotType, ...(attack.flags ?? []), ...compatTags]);

/** The selection for an attack's own stats. */
export const selectionOf = (weapon: Weapon, attack: Attack): Selection => ({
  scope: attack.flags?.includes('isAoE') === true ? 'aoe' : 'direct',
  attackTags: attackTagsOf(weapon, attack),
});

/** A bucket without a scope (fire rate, magazine) is not about damage, so it reaches everything. */
const reaches = ({ scope: reach, bodyPart }: Bucket, { scope, bodyParts }: Selection) => {
  const isInScope = Object.keys(reach).length === 0 || reach[scope] !== undefined;
  return isInScope && (bodyPart === undefined || bodyParts?.has(bodyPart) === true);
};

const matches = <Value>(wanted: readonly Value[] | undefined, has: (value: Value) => boolean) =>
  wanted?.some(has) ?? true;

const passesFilter = ({ filter = {} }: CollectedEffect, selection: Selection) => {
  const parts = filter.bodyPart === undefined ? undefined : [filter.bodyPart];
  return (
    matches(filter.attackTags, (tag) => selection.attackTags.has(tag)) &&
    matches(filter.damageTypes, (type) => type === selection.damageType) &&
    matches(parts, (part) => selection.bodyParts?.has(part) === true)
  );
};

/** The effects that apply to a selection. An effect's own scope narrows its bucket's. */
export const selectEffects = (
  effects: readonly CollectedEffect[],
  selection: Selection,
  reference: Pick<Reference, 'buckets' | 'factions'>,
): readonly CollectedEffect[] =>
  effects.filter((effect) => {
    const bucket = findBucket(effect.bucket, reference);
    if (bucket === undefined || !reaches(bucket, selection)) return false;
    const isInScope = effect.scope?.includes(selection.scope) ?? true;
    return isInScope && passesFilter(effect, selection);
  });
