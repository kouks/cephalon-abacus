import type { Bucket } from '@/schema/bucket';

import type { Reference } from './library';

/** A member every faction bonus applies to, whatever the target: Roar, Damage Blessing. */
export const ALL_FACTIONS = 'all';

const isMember = (
  { members }: Bucket,
  member: string,
  factions: Reference['factions'],
): boolean => {
  if (members === undefined) return false;
  if (members === 'any') return true;
  if (members !== 'factionModGroup') return members.includes(member);
  const groups = [...factions.values()].map(({ factionModGroup }) => factionModGroup);
  return member === ALL_FACTIONS || groups.includes(member);
};

/** The bucket a name belongs to: the one with that id, or the family its last part is a member of. */
export const findBucket = (
  name: string,
  { buckets, factions }: Pick<Reference, 'buckets' | 'factions'>,
): Bucket | undefined => {
  const exact = buckets.get(name);
  if (exact !== undefined) return exact.members === undefined ? exact : undefined;

  const dot = name.lastIndexOf('.');
  const family = buckets.get(name.slice(0, Math.max(dot, 0)));
  if (family === undefined) return undefined;
  return isMember(family, name.slice(dot + 1), factions) ? family : undefined;
};
