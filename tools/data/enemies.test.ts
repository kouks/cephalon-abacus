import { expect, it } from 'vitest';

import { loadRealLibrary } from './loadRealLibrary.ts';

const { enemies } = loadRealLibrary();

it('the seed enemies have the parts of the game', () => {
  const lines = [...enemies.values()].flatMap(({ id, bodyParts }) =>
    bodyParts.map(
      ({ id: part, multiplier, countsAs = [], headcrit = 1 }) =>
        `${id}: ${part} ${multiplier}x, ${countsAs.join(' and ')}, ${headcrit}x crits`,
    ),
  );
  expect(lines).toEqual([
    'charger: body 1x, , 1x crits',
    'charger: head 1x, head and weakPoint, 2x crits',
    'runner: body 1x, , 1x crits',
    'runner: head 3x, head and weakPoint, 2x crits',
  ]);
});

it('the seed enemies have the base stats of the game', () => {
  const lines = [...enemies.values()].map(
    ({ id, faction, baseLevel, baseHealth, baseShield, baseArmor, baseOverguard }) =>
      `${id}: ${faction}, level ${baseLevel}, ${baseHealth} health, ${baseShield} shield, ${baseArmor} armor, ${baseOverguard} overguard`,
  );
  expect(lines).toEqual([
    'charger: infested, level 1, 80 health, 0 shield, 0 armor, 0 overguard',
    'runner: infested, level 1, 100 health, 0 shield, 0 armor, 0 overguard',
  ]);
});
