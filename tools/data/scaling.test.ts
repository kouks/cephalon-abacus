import { describe, expect, it } from 'vitest';

import { enemySchema } from '#data/schema/enemy.ts';
import type { Met } from '#engine/enemy/scaleEnemy.ts';
import { scaleEnemy } from '#engine/enemy/scaleEnemy.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();

/** A made-up enemy with a base of 100 each, at level 1. */
const makeEnemy = (change: object) =>
  enemySchema.parse({
    id: 'made-up',
    name: 'Made up',
    source: 'https://wiki.warframe.com/w/Enemy_Level_Scaling',
    gameVersion: '44.1.4.1',
    faction: 'grineer',
    scalingProfile: 'grineer',
    baseLevel: 1,
    baseHealth: 100,
    baseShield: 0,
    baseArmor: 0,
    baseOverguard: 0,
    bodyParts: [{ id: 'body', multiplier: 1 }],
    ...change,
  });

const scale = (change: object, met: Partial<Met> = {}) =>
  scaleEnemy(makeEnemy(change), { level: 1, steelPath: false, ...met }, library);

const LEVELS = [1, 50, 75, 100, 150, 300];

/** Each spot value is worked out by hand from the wiki's formulas, in 32 bits (BIBLE §10). */
describe('the wiki’s curves, at levels 1, 50, 75, 100, 150 and 300', () => {
  it.each([
    ['grineer', [100, 5845.22, 17399.07, 29448.55, 39493.39, 65144.8]],
    ['scaldra', [100, 5845.22, 17399.07, 29448.55, 39493.39, 65144.8]],
    ['corpus', [100, 5845.22, 14059.5, 16897.27, 21132.54, 30950.24]],
    ['infested', [100, 8717.83, 26048.61, 44122.82, 59190.09, 97667.19]],
    ['orokin', [100, 5414.99, 15491.66, 25088.45, 33164.49, 53379.98]],
    ['anarchs', [100, 5414.99, 15491.66, 25088.45, 33164.49, 53379.98]],
    ['murmur', [100, 3701.5, 8672.71, 10779.4, 13201.54, 18659.44]],
    ['sentient', [100, 3701.5, 8672.71, 10779.4, 13201.54, 18659.44]],
    ['unaffiliated', [100, 3701.5, 8672.71, 10779.4, 13201.54, 18659.44]],
    ['techrot', [100, 7760.29, 22809.06, 37763.08, 50241.99, 81747.14]],
  ])('health: %s', (scalingProfile, expected) => {
    const values = LEVELS.map((level) => scale({ scalingProfile }, { level }).health.value);
    expect(values.map((value) => Number(value.toFixed(2)))).toEqual(expected);
  });

  it.each([
    ['corpus', [100, 1987.01, 4480.45, 6672.23, 9067.09, 15324.4]],
    ['orokin', [100, 1914.99, 4295.91, 6377.06, 8629.42, 14480.81]],
    ['anarchs', [100, 1914.99, 4295.91, 6377.06, 8629.42, 14480.81]],
    ['grineer', [100, 1914.99, 3940.67, 5121.65, 6923.54, 11604.65]],
    ['sentient', [100, 1914.99, 3940.67, 5121.65, 6923.54, 11604.65]],
    ['techrot', [100, 1987.01, 5871.2, 11601.4, 15792.41, 26742.69]],
  ])('shields: %s', (scalingProfile, expected) => {
    const change = { scalingProfile, baseShield: 100 };
    const values = LEVELS.map((level) => scale(change, { level }).shield.value);
    expect(values.map((value) => Number(value.toFixed(2)))).toEqual(expected);
  });

  it('armor, from 200 to 2,700 for everyone', () => {
    const armorAt = (baseArmor: number) => (level: number) =>
      Number(scale({ baseArmor, scalingProfile: 'techrot' }, { level }).armor.value.toFixed(2));
    expect(LEVELS.map(armorAt(100))).toEqual([200, 553.75, 1060.17, 1355.41, 1805.88, 2700]);
    expect(LEVELS.map(armorAt(500))).toEqual([500, 2700, 2700, 2700, 2700, 2700]);
  });

  it('Overguard, by the level alone', () => {
    const overguardAt = (baseLevel: number) => (level: number) =>
      scale({ baseLevel, baseOverguard: 12 }, { level }).overguard.value;
    const expected = [12, 103623.16, 150140.48, 195098.06, 281865, 527556];
    expect(LEVELS.map((level) => Number(overguardAt(1)(level).toFixed(2)))).toEqual(expected);
    expect(LEVELS.map(overguardAt(30))).toEqual(LEVELS.map(overguardAt(1)));
    const blend = [46, 48, 51].map((level) => Number(overguardAt(1)(level).toFixed(2)));
    expect(blend).toEqual([73823.25, 92051.09, 105505.95]);
  });
});

describe('an Eximus unit', () => {
  const startAt = (change: object, level: number) => {
    const { health } = scale({ flags: ['eximus'], ...change }, { level });
    const start = health.terms.find(({ name }) => name === 'eximusBase')?.value ?? 0;
    return Number(start.toFixed(4));
  };
  const starts = (change: object) =>
    [1, 15, 20, 30, 40, 60, 100, 200].map((level) => startAt(change, level));

  it('starts from the wiki’s base health', () => {
    expect(starts({ baseHealth: 300, baseArmor: 100 })).toEqual([
      330, 330, 337.5, 562.5, 950, 1440, 1800, 1800,
    ]);
    expect(starts({ baseHealth: 300 })).toEqual([450, 450, 506.25, 843.75, 1425, 2160, 2700, 2700]);
    expect(starts({ baseHealth: 5000, baseArmor: 100 })).toEqual([
      5500, 5500, 5500, 5500, 5500, 7080, 8850, 8850,
    ]);
  });
});

describe('the Steel Path', () => {
  it('adds levels, health and shields by mission', () => {
    const rules = [...library.scaling.values()].flatMap((rule) =>
      rule.kind === 'mission' ? [{ id: rule.id, ...rule.steelPath }] : [],
    );
    expect(rules).toEqual([
      { id: 'star-chart', levels: 100, health: 2.5, shield: 2.5 },
      { id: 'archwing', levels: 50, health: 2.5, shield: 2.5 },
      { id: 'empyrean', levels: 50, health: 2.5, shield: 2.5 },
      { id: 'duviri', levels: 20, health: 1, shield: 1 },
      { id: 'simulacrum', levels: 0, health: 2.5, shield: 2.5 },
    ]);
  });

  it('makes a level 100 Runner a level 200 one with 2.5 times the health', () => {
    const runner = library.enemies.get('runner');
    if (runner === undefined) throw new Error('No Runner');
    const health = (met: Met) => Number(scaleEnemy(runner, met, library).health.value.toFixed(2));
    expect(health({ level: 200, steelPath: false })).toBe(72877.11);
    expect(health({ level: 100, steelPath: true })).toBe(182192.78);
    expect(health({ level: 200, steelPath: true, mission: 'simulacrum' })).toBe(182192.78);
  });
});
