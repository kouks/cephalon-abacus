import { describe, expect, it } from 'vitest';

import type { Library } from '@abacus/data/load/library';
import { loadLibrary } from '@abacus/data/load/loadLibrary';
import { enemy, libraryFile, referenceFiles } from '@abacus/data/testing/fixtures';
import { curve, eximus, steelPath, whole } from '@abacus/data/testing/scaling';

import type { Met } from './scaleEnemy';
import { enemyStats, scaleEnemy } from './scaleEnemy';

const stat = (id: string, change: object = {}) => ({ ...curve, id, stat: id, ...change });

const RULES = [
  curve,
  stat('shield'),
  stat('armor', { limits: { least: 200, most: 2700 } }),
  stat('overguard', { above: 'one' }),
  eximus,
  steelPath,
];

const FULL = { baseShield: 10, baseArmor: 100, baseOverguard: 12 };

const libraryWith = (change: object, rules: readonly object[] = RULES): Library => {
  const result = loadLibrary([
    ...referenceFiles.filter(({ path }) => path !== 'scaling.json'),
    libraryFile('scaling.json', ...rules),
    libraryFile('enemies/a.json', { ...enemy, ...change }),
  ]);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.library;
};

const scale = (change: object, met: Partial<Met> = {}) => {
  const library = libraryWith(change);
  const found = library.enemies.get('test-enemy');
  if (found === undefined) throw new Error('No enemy');
  return scaleEnemy(found, { level: 11, steelPath: false, ...met }, library);
};

const valuesOf = ({ level, health, shield, armor, overguard }: ReturnType<typeof scale>) =>
  [level, health.value, shield.value, armor.value, overguard.value].map((value) =>
    Number(value.toFixed(4)),
  );

const termsOf = (terms: readonly { name: string; value: number }[]) =>
  Object.fromEntries(terms.map(({ name, value }) => [name, Number(value.toFixed(4))]));

describe('an enemy at its level', () => {
  it('has every stat scaled', () => {
    expect(valuesOf(scale(FULL))).toEqual([11, 200, 20, 200, 24]);
    expect(valuesOf(scale({ ...FULL, baseLevel: 6 }))).toEqual([11, 125, 12.5, 200, 24]);
  });

  it('has none of what it starts without', () => {
    const { shield, armor, overguard } = scale({});
    expect([shield, armor, overguard]).toEqual(
      [0, 0, 0].map((value) => ({ value, terms: [{ name: 'base', value }] })),
    );
  });

  it('says what made a stat: base × growth', () => {
    expect(termsOf(scale({}, { level: 76 }).health.terms)).toEqual({
      base: 100,
      levels: 75,
      low: 57.25,
      high: 87.6025,
      blend: 0.5,
      growth: 72.4263,
    });
  });

  it('keeps armor within its limits, which no other stat has', () => {
    expect(termsOf(scale({ baseArmor: 100 }, { level: 1 }).armor.terms)).toMatchObject({
      growth: 1,
      limit: 200,
    });
    expect(scale({ baseArmor: 1000 }, { level: 101 }).armor.value).toBe(2700);
    expect(scale({ baseArmor: 150 }, { level: 11 }).armor.terms.at(-1)?.name).toBe('growth');
    expect(scale({ baseHealth: 1 }, { level: 1 }).health.value).toBe(1);
  });
});

it('keeps whole the stats the game keeps whole, to the nearest (T-46)', () => {
  const library = libraryWith(FULL, [...RULES, whole]);
  const found = library.enemies.get('test-enemy');
  if (found === undefined) throw new Error('No enemy');
  const { health, shield } = scaleEnemy(found, { level: 76, steelPath: false }, library);
  expect([Number(health.value.toFixed(2)), shield.value]).toEqual([7242.63, 724]);
  expect(shield.terms.at(-1)).toEqual({ name: 'whole', value: 724 });
  expect(scale(FULL, { level: 76 }).shield.value).toBeCloseTo(724.263, 3);
});

describe('on the Steel Path, an enemy', () => {
  const normal = scale({ ...FULL, baseArmor: 10 }, { level: 101 });
  const steel = scale({ ...FULL, baseArmor: 10 }, { level: 101, steelPath: true });

  it('has the same level', () => {
    expect([normal.level, steel.level]).toEqual([101, 101]);
  });

  it('has more health and shields, and no more armor or Overguard', () => {
    expect(steel.health.value).toBeCloseTo(2.5 * normal.health.value, 3);
    expect(steel.shield.value).toBeCloseTo(2 * normal.shield.value, 3);
    expect([steel.armor, steel.overguard]).toEqual([normal.armor, normal.overguard]);
    expect(steel.health.terms.at(-1)).toEqual({ name: 'steelPath', value: 2.5 });
    expect(steel.shield.terms.at(-1)).toEqual({ name: 'steelPath', value: 2 });
  });
});

describe('an Eximus unit', () => {
  const EXIMUS = { ...FULL, baseHealth: 300, flags: ['eximus'] };

  it('starts from more health and shields, at the level it is met at', () => {
    const { health, shield, overguard } = scale(EXIMUS, { level: 25 });
    expect(termsOf(health.terms)).toMatchObject({ base: 300, eximusBase: 600, levels: 24 });
    expect(health.value).toBeCloseTo(600 * 6.76, 2);
    expect(shield.value).toBeCloseTo(20 * 6.76, 3);
    expect(overguard.value).toBeCloseTo(12 * 6.76, 3);
    const steel = scale(EXIMUS, { level: 25, steelPath: true });
    expect(termsOf(steel.health.terms)).toMatchObject({ eximusBase: 600, steelPath: 2.5 });
  });

  it('is flagged as one', () => {
    const plain = scale({ ...FULL, baseHealth: 300 }, { level: 25 });
    expect(plain.health.terms.map(({ name }) => name)).not.toContain('eximusBase');
    expect(scale({ ...EXIMUS, flags: ['boss'] }, { level: 25 })).toEqual(plain);
  });
});

it('the neutral dummy has no stats', () => {
  const library = libraryWith({});
  const met = { level: 11, steelPath: false, modifiers: [] };
  expect(enemyStats({ id: 'neutral-dummy', ...met }, library)).toBeUndefined();
  expect(enemyStats({ id: 'test-enemy', ...met }, library)?.health.value).toBeCloseTo(200, 4);
});
