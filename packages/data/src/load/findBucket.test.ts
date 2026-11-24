import { describe, expect, it } from 'vitest';

import { bucketSchema } from '@/schema/bucket';
import { factionSchema } from '@/schema/faction';
import { bucket, faction, family } from '@/testing/fixtures';

import { findBucket } from './findBucket';

const buckets = [
  bucket,
  family,
  { ...family, id: 'damage.ips', members: ['impact', 'slash'] },
  { ...family, id: 'damage.final', members: 'any' },
].map((item) => bucketSchema.parse(item));

const { name, source, gameVersion, damageProfile } = faction;
const withoutGroup = { id: 'narmer', name, source, gameVersion, damageProfile };

const factions = [faction, { ...faction, id: 'kuva-grineer' }, withoutGroup].map((item) =>
  factionSchema.parse(item),
);

const reference = {
  buckets: new Map(buckets.map((item) => [item.id, item])),
  factions: new Map(factions.map((item) => [item.id, item])),
};

describe('findBucket', () => {
  it.each([
    ['damage.base', 'damage.base'],
    ['damage.ips.impact', 'damage.ips'],
    ['damage.faction.grineer', 'damage.faction'],
    ['damage.faction.all', 'damage.faction'],
    ['damage.final.eclipse', 'damage.final'],
  ])('finds %s in %s', (name, id) => {
    expect(findBucket(name, reference)?.id).toBe(id);
  });

  it.each([
    ['an unknown name', 'damage.bse'],
    ['a family by itself', 'damage.faction'],
    ['a member of a bucket that is no family', 'damage.base.heat'],
    ['a member the family does not list', 'damage.ips.heat'],
    ['a faction that is not a mod group', 'damage.faction.kuva-grineer'],
    ['a faction without a mod group', 'damage.faction.narmer'],
    ['a member two levels down', 'damage.final.eclipse.mirage'],
    ['a first part alone', 'damage'],
    ['nothing', ''],
  ])('refuses %s', (_name, name) => {
    expect(findBucket(name, reference)).toBeUndefined();
  });
});
