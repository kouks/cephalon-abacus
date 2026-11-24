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

/** Every bucket's total for a selection at a moment, with the effects that made it. */
export const totalBuckets = (
  collected: Collected,
  reference: Buckets,
  { selection, moment = startOf(collected) }: { selection: Selection; moment?: Moment },
): BucketTotals => {
  const selected = selectEffects(collected.effects, selection, reference);
  const groups = groupByBucket(contributionsOf(selected, collected, moment));
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
