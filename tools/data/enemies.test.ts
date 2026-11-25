import { expect, it } from 'vitest';

import { loadRealLibrary } from './loadRealLibrary.ts';

const { enemies } = loadRealLibrary();

it('the seed enemies have the base stats of the game', () => {
  const lines = [...enemies.values()].map(
    ({ id, faction, baseLevel, baseHealth, baseShield, baseArmor, baseOverguard }) =>
      `${id}: ${faction}, level ${baseLevel}, ${baseHealth} health, ${baseShield} shield, ${baseArmor} armor, ${baseOverguard} overguard`,
  );
  expect(lines).toEqual(['charger: infested, level 1, 80 health, 0 shield, 0 armor, 0 overguard']);
});
