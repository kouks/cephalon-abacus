import { describe, expect, it } from 'vitest';

import { must } from '@/assert';
import { baseOf, enemySchema } from '@/schema/enemy';
import type { ScaledStat } from '@/schema/scaling';
import { scalingRuleSchema } from '@/schema/scaling';
import { enemy, libraryFile, referenceFiles } from '@/testing/fixtures';
import { curve, eximus, mission } from '@/testing/scaling';

import { findCurve } from './findCurve';
import { formatError } from './libraryError';
import { loadLibrary } from './loadLibrary';

const rules = (...items: readonly object[]) => libraryFile('scaling.json', ...items);

const errorsOf = (scaling: readonly object[], ...enemies: readonly object[]) => {
  const others = referenceFiles.filter(({ path }) => path !== 'scaling.json');
  const result = loadLibrary([
    ...others,
    rules(...scaling),
    libraryFile('enemies/a.json', ...enemies),
  ]);
  return result.ok ? [] : result.errors.map(formatError);
};

const RULES = [curve, eximus, mission];

/** The same curve for every profile. */
const forEveryone = (change: object = {}): object => {
  const entries = Object.entries(curve).filter(([key]) => key !== 'profiles');
  return { ...Object.fromEntries(entries), ...change };
};

describe('an enemy', () => {
  const errorsIn = (change: object) => errorsOf(RULES, { ...enemy, ...change });

  it('loads, with everything it can have', () => {
    const boss = { statusCaps: { cold: 4 }, flags: ['boss'], drHooks: ['enemy.boss.shield'] };
    expect([errorsIn({}), errorsIn(boss)]).toEqual([[], []]);
  });

  it('is of a faction', () => {
    expect(errorsIn({ faction: 'corpse' })).toEqual([
      'enemies/a.json: items[0].faction: "corpse" is not a faction (factions.json)',
    ]);
  });

  it('has a curve for every stat it has', () => {
    const message = 'enemies/a.json: items[0].scalingProfile: "grineer" has no curve for';
    expect(errorsIn({ baseShield: 5, baseOverguard: 12 })).toEqual([
      `${message} shield (scaling.json)`,
      `${message} overguard (scaling.json)`,
    ]);
    expect(errorsIn({ scalingProfile: 'corpus' })).toEqual([
      'enemies/a.json: items[0].scalingProfile: "corpus" has no curve for health (scaling.json)',
    ]);
  });

  it.each([
    ['no body', [{ id: 'head', multiplier: 3 }], 'Expected a part "body"'],
    ['a part twice', [...enemy.bodyParts, enemy.bodyParts[1]], 'Expected each part once'],
    ['no parts', undefined, 'Invalid input: expected array'],
  ])('has %s', (_name, bodyParts, message) => {
    const [error, ...more] = errorsIn({ bodyParts });
    expect(error).toContain(`enemies/a.json: items[0].bodyParts: ${message}`);
    expect(more).toEqual([]);
  });

  it.each([
    ['a part that counts as nothing', { bodyParts: [{ id: 'body', multiplier: 1, countsAs: [] }] }],
    ['an unknown status', { statusCaps: { freeze: 4 } }],
    ['an unknown flag', { flags: ['elite'] }],
    ['no health', { baseHealth: 0 }],
    ['a hook that is none', { drHooks: ['shield'] }],
  ])('refuses %s', (_name, change) => {
    expect(errorsIn(change)).toHaveLength(1);
  });

  it('has its base stats in one place', () => {
    const parsed = enemySchema.parse({ ...enemy, baseArmor: 5, baseOverguard: 12, baseShield: 7 });
    expect(baseOf(parsed)).toEqual({ health: 100, shield: 7, armor: 5, overguard: 12 });
  });
});

describe('scaling.json', () => {
  it('can have one curve for every profile', () => {
    const everyone = forEveryone();
    expect(errorsOf([everyone, eximus, mission], { ...enemy, scalingProfile: 'any' })).toEqual([]);
  });

  it.each([
    ['the same profile', { ...curve, id: 'b', profiles: ['corpus', 'grineer'] }],
    ['a curve for everyone', forEveryone({ id: 'b' })],
  ])('refuses two curves for a stat: %s', (_name, second) => {
    expect(errorsOf([...RULES, second])).toEqual([
      'scaling.json: items[3].profiles: "grineer-health" is already a curve for this health',
    ]);
  });

  it('accepts another stat and another profile', () => {
    const shield = { ...curve, id: 'b', stat: 'shield' };
    const corpus = { ...curve, id: 'c', profiles: ['corpus'] };
    expect(errorsOf([...RULES, shield, corpus])).toEqual([]);
  });

  it('has the star chart, and one Eximus rule', () => {
    expect(errorsOf([curve])).toEqual([
      'scaling.json: items: No mission "star-chart"',
      'scaling.json: items: Expected one Eximus rule, found 0',
    ]);
    expect(errorsOf([curve, eximus, { ...mission, id: 'archwing' }])).toEqual([
      'scaling.json: items: No mission "star-chart"',
    ]);
    const second = { ...eximus, id: 'eximus-2' };
    expect(errorsOf([...RULES, second])).toEqual([
      'scaling.json: items: Expected one Eximus rule, found 2',
    ]);
  });

  it.each([
    ['a blend that ends first', { ...curve, blend: { from: 80, to: 70 } }, 'from below to'],
    ['no profiles at all', { ...curve, profiles: [] }, 'Too small'],
    ['an unknown stat', { ...curve, stat: 'damage' }, 'Invalid option'],
    ['an unknown kind', { ...curve, kind: 'line' }, 'Invalid'],
    ['a single point', { ...eximus, multiplier: [{ level: 1, value: 1 }] }, 'Too small'],
  ])('refuses %s', (_name, item, message) => {
    expect(scalingRuleSchema.safeParse(item).error?.message).toContain(message);
  });
});

describe('findCurve', () => {
  const armor = forEveryone({ id: 'armor', stat: 'armor' });
  const parsed = [curve, armor, eximus].map((item) => scalingRuleSchema.parse(item));
  const scaling = new Map(parsed.map((rule) => [rule.id, rule]));
  const find = (stat: ScaledStat, profile: string) => findCurve(stat, profile, { scaling })?.id;

  it('finds the curve of a profile, or the one for everyone', () => {
    expect(find('health', 'grineer')).toBe('grineer-health');
    expect(find('health', 'corpus')).toBeUndefined();
    expect([find('armor', 'grineer'), find('armor', 'corpus')]).toEqual(['armor', 'armor']);
    expect(must(scaling.get('armor'), 'no armor').id).toBe('armor');
  });
});
