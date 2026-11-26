import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import type { EnemyStats } from '#engine/enemy/scaleEnemy.ts';
import { scaleEnemy } from '#engine/enemy/scaleEnemy.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();
const enemies = [...library.enemies.values()];

/** Body parts as the wiki's table has them, e.g. "head 3x head weakPoint headcrit 2". */
const partsOf = ({ bodyParts }: (typeof enemies)[number]) =>
  bodyParts
    .map(({ id, multiplier, countsAs = [], headcrit, promotes }) =>
      [
        id,
        `${multiplier}x`,
        ...countsAs,
        ...(headcrit === undefined ? [] : [`headcrit ${headcrit}`]),
        ...(promotes === undefined ? [] : ['promotes']),
      ].join(' '),
    )
    .join(', ');

const HEAD = 'body 1x, head 3x head weakPoint headcrit 2';

it('the enemies have the body parts of the game', () => {
  expect(enemies.map((enemy) => [enemy.id, partsOf(enemy)])).toEqual([
    ['crewman', 'body 1x, head 3x head weakPoint'],
    ['moa', 'body 1x, gun 0.5x, head 1x head weakPoint, fanny-pack 3x weakPoint'],
    ['amalgam-heqet', 'body 1x, head 1x head weakPoint, backpack 2x weakPoint'],
    ['corrupted-lancer', HEAD],
    ['corrupted-heavy-gunner', HEAD],
    ['butcher', HEAD],
    ['lancer', HEAD],
    ['heavy-gunner', HEAD],
    ['kuva-lancer', HEAD],
    ['drekar-lancer-eximus', HEAD],
    ['charger', 'body 1x, head 1x head weakPoint headcrit 2'],
    ['runner', HEAD],
    ['charger-eximus', 'body 1x, head 1x head weakPoint headcrit 2'],
    ['deimos-runner', HEAD],
    ['zealoid-prelate', HEAD],
    ['rogue-arcocanid', 'body 1x, head 1.5x head weakPoint headcrit 2'],
    ['rogue-culverin', 'body 1x, canisters 1.5x head weakPoint headcrit 2 promotes'],
    ['scaldra-jaeger', `${HEAD}, backpack 1.5x head weakPoint headcrit 2 promotes`],
    ['scaldra-eradicator', HEAD],
    ['techrot-obsolyte', `${HEAD}, monitors 1.5x head weakPoint headcrit 2 promotes`],
  ]);
});

it('the enemies have the base stats of the game', () => {
  const lines = enemies.map(
    ({ id, faction, baseLevel, baseHealth, baseShield, baseArmor, baseOverguard, flags = [] }) =>
      [
        `${id}: ${faction} ${baseLevel}`,
        `${baseHealth} health`,
        `${baseShield} shield`,
        `${baseArmor} armor`,
        `${baseOverguard} overguard`,
        ...flags,
      ].join(', '),
  );
  expect(lines).toEqual([
    'crewman: corpus 1, 90 health, 120 shield, 0 armor, 0 overguard',
    'moa: corpus 1, 90 health, 120 shield, 0 armor, 0 overguard',
    'amalgam-heqet: corpus-amalgam 1, 500 health, 400 shield, 0 armor, 0 overguard',
    'corrupted-lancer: orokin 1, 100 health, 0 shield, 200 armor, 0 overguard',
    'corrupted-heavy-gunner: orokin 8, 700 health, 0 shield, 500 armor, 0 overguard',
    'butcher: grineer 1, 50 health, 0 shield, 5 armor, 0 overguard',
    'lancer: grineer 1, 100 health, 0 shield, 100 armor, 0 overguard',
    'heavy-gunner: grineer 8, 300 health, 0 shield, 500 armor, 0 overguard',
    'kuva-lancer: kuva-grineer 1, 100 health, 0 shield, 100 armor, 0 overguard',
    'drekar-lancer-eximus: grineer 1, 100 health, 0 shield, 100 armor, 12 overguard, eximus',
    'charger: infested 1, 80 health, 0 shield, 0 armor, 0 overguard',
    'runner: infested 1, 100 health, 0 shield, 0 armor, 0 overguard',
    'charger-eximus: infested 1, 80 health, 0 shield, 0 armor, 12 overguard, eximus',
    'deimos-runner: infested-deimos 1, 100 health, 0 shield, 0 armor, 0 overguard',
    'zealoid-prelate: infested 1, 9000 health, 0 shield, 0 armor, 0 overguard, boss, hasAttenuation',
    'rogue-arcocanid: murmur 1, 80 health, 0 shield, 100 armor, 0 overguard',
    'rogue-culverin: murmur 1, 500 health, 0 shield, 175 armor, 0 overguard',
    'scaldra-jaeger: scaldra 1, 125 health, 0 shield, 100 armor, 0 overguard',
    'scaldra-eradicator: scaldra 1, 325 health, 0 shield, 500 armor, 0 overguard',
    'techrot-obsolyte: techrot 1, 400 health, 200 shield, 0 armor, 0 overguard',
  ]);
});

it('cover every faction that the ticket asked for', () => {
  const factions = [...new Set(enemies.map(({ faction }) => faction))].sort();
  expect(factions).toEqual([
    'corpus',
    'corpus-amalgam',
    'grineer',
    'infested',
    'infested-deimos',
    'kuva-grineer',
    'murmur',
    'orokin',
    'scaldra',
    'techrot',
  ]);
  const boss = must(library.enemies.get('zealoid-prelate'), 'No boss');
  expect(boss.statusCaps).toEqual({ cold: 4 });
});

const statsAt = (id: string, level: number, steelPath = false): EnemyStats =>
  scaleEnemy(must(library.enemies.get(id), `No ${id}`), { level, steelPath }, library);

const rounded = ({ health, shield, armor, overguard }: EnemyStats) =>
  [health, shield, armor, overguard].map(({ value }) => Math.round(value));

/**
 * Health, shield, armor and Overguard, worked out from the wiki's formulas apart from the code. The
 * game keeps shields whole to the nearest (T-46), and armor whole rounded down (T-48).
 */
describe('the enemies at levels 50 and 150', () => {
  it.each([
    ['crewman', [5261, 2384, 0, 0], [19019, 10881, 0, 0]],
    ['moa', [5261, 2384, 0, 0], [19019, 10881, 0, 0]],
    ['amalgam-heqet', [29226, 7948, 0, 0], [105663, 36268, 0, 0]],
    ['corrupted-lancer', [5415, 0, 1107, 0], [33164, 0, 2700, 0]],
    ['corrupted-heavy-gunner', [27616, 0, 2232, 0], [224647, 0, 2700, 0]],
    ['butcher', [2923, 0, 200, 0], [19747, 0, 200, 0]],
    ['lancer', [5845, 0, 553, 0], [39493, 0, 1805, 0]],
    ['heavy-gunner', [12731, 0, 2232, 0], [114456, 0, 2700, 0]],
    ['kuva-lancer', [5845, 0, 553, 0], [39493, 0, 1805, 0]],
    ['drekar-lancer-eximus', [65759, 0, 553, 103623], [592401, 0, 1805, 281865]],
    ['charger', [6974, 0, 0, 0], [47352, 0, 0, 0]],
    ['runner', [8718, 0, 0, 0], [59190, 0, 0, 0]],
    ['charger-eximus', [144171, 0, 0, 103623], [1305142, 0, 0, 281865]],
    ['deimos-runner', [8718, 0, 0, 0], [59190, 0, 0, 0]],
    ['zealoid-prelate', [784605, 0, 0, 0], [5327109, 0, 0, 0]],
    ['rogue-arcocanid', [2961, 0, 553, 0], [10561, 0, 1805, 0]],
    ['rogue-culverin', [18508, 0, 969, 0], [66008, 0, 2700, 0]],
    ['scaldra-jaeger', [7307, 0, 553, 0], [49367, 0, 1805, 0]],
    ['scaldra-eradicator', [18997, 0, 2700, 0], [128354, 0, 2700, 0]],
    ['techrot-obsolyte', [31041, 3974, 0, 0], [200968, 31585, 0, 0]],
  ])('%s', (id, at50, at150) => {
    expect(rounded(statsAt(id, 50))).toEqual(at50);
    expect(rounded(statsAt(id, 150))).toEqual(at150);
  });

  it.each(enemies.map(({ id }) => id))('%s on the Steel Path', (id) => {
    for (const level of [50, 150]) {
      const [plain, steel] = [statsAt(id, level), statsAt(id, level, true)];
      expect(steel.health.value / plain.health.value).toBeCloseTo(2.5, 5);
      // Both are rounded to whole numbers (T-46): 0.5 off, and 2.5 × 0.5 off.
      expect(Math.abs(steel.shield.value - plain.shield.value * 2.5)).toBeLessThanOrEqual(1.75);
      expect([steel.armor.value, steel.overguard.value]).toEqual([
        plain.armor.value,
        plain.overguard.value,
      ]);
    }
  });

  it('three of them on the Steel Path, to the point', () => {
    expect(rounded(statsAt('crewman', 150, true))).toEqual([47548, 27201, 0, 0]);
    expect(rounded(statsAt('lancer', 50, true))).toEqual([14613, 0, 553, 0]);
    expect(rounded(statsAt('charger-eximus', 150, true))).toEqual([3262854, 0, 0, 281865]);
  });
});
