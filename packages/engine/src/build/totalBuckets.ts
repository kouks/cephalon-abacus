import { findBucket } from '@abacus/data/load/findBucket';
import type { Reference } from '@abacus/data/load/library';

import type { BucketTotal } from './aggregate';
import { totalOf } from './aggregate';
import type { Moment } from './contributions';
import { contributionsOf, NO_VARIABLES, startingStacks } from './contributions';
import type { Selection } from './selectEffects';
import { selectEffects } from './selectEffects';
import type { Collected, Contribution } from './types';

type Buckets = Pick<Reference, 'buckets' | 'factions'>;

/** Every bucket by name, with or without effects. Families appear by the members that have some. */
export type BucketTotals = ReadonlyMap<string, BucketTotal>;

const groupByBucket = (contributions: readonly Contribution[]) => {
  const groups = new Map<string, Contribution[]>();
  for (const entry of contributions) {
    const group = groups.get(entry.bucket) ?? [];
    group.push(entry);
    groups.set(entry.bucket, group);
  }
  return groups;
};

/** How the build starts: its switches' stacks, and nothing on the target. */
export const startOf = (collected: Collected): Moment => ({
  stacks: startingStacks(collected),
  variables: NO_VARIABLES,
});

type When = { readonly selection: Selection; readonly moment?: Moment };

/** What reaches a selection at a moment, in the order the build lists it. */
export const contributionsTo = (
  collected: Collected,
  reference: Buckets,
  { selection, moment = startOf(collected) }: When,
): readonly Contribution[] =>
  contributionsOf(selectEffects(collected.effects, selection, reference), collected, moment);

/** Every bucket's total, with the effects that made it. */
export const sumBuckets = (
  contributions: readonly Contribution[],
  reference: Buckets,
): BucketTotals => {
  const groups = groupByBucket(contributions);
  const plain = [...reference.buckets.values()]
    .filter(({ members }) => members === undefined)
    .map(({ id }) => id);

  const names = new Set([...plain, ...groups.keys()]);
  return new Map(
    [...names].map((name) => [
      name,
      totalOf(name, groups.get(name) ?? [], findBucket(name, reference) ?? {}),
    ]),
  );
};

/** Every bucket's total for a selection at a moment. */
export const totalBuckets = (collected: Collected, reference: Buckets, when: When): BucketTotals =>
  sumBuckets(contributionsTo(collected, reference, when), reference);
