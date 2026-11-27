import { describe, expect, it } from 'vitest';

import { scenarioSchema } from '#data/schema/scenario.ts';
import { scenario } from '#data/testing/fixtures.ts';
import { simulate } from '#engine/api.ts';
import { firingModes } from '#engine/metrics/firingModes.ts';

import { realLibrary as library } from './realAttack.ts';

const LANCER = { id: 'lancer', level: 30, steelPath: false, modifiers: [] };

/** A seed weapon's firing mode, unmodded, on the body of a level 30 Lancer for up to 30 s. */
const fightWith = (weaponId: string, attackId: string) => {
  const build = { ...scenario.build, weaponId, attackId, modules: [] };
  const fight = { ...scenario, build, enemy: LANCER, aim: { head: 0, body: 1 }, duration: 30 };
  return simulate(scenarioSchema.parse(fight), library);
};

const modes = [...library.weapons.values()].flatMap((weapon) =>
  firingModes(weapon).map((attack) => ({ name: `${weapon.name}, ${attack.name}`, weapon, attack })),
);

describe('every seed weapon, in a fight over time', () => {
  it('kills a level 30 Lancer, unmodded, in this long', () => {
    const lines = modes.map(({ name, weapon, attack }) => {
      const { timeToKill, direct, dot } = fightWith(weapon.id, attack.id);
      const killed = timeToKill === undefined ? 'lives' : `${timeToKill.toFixed(3)} s`;
      return `${name}: ${killed}, ${Math.round(direct)} direct, ${Math.round(dot)} DoT`;
    });
    expect(lines).toMatchInlineSnapshot(`
      [
        "Braton, Normal Attack: 11.714 s, 1933 direct, 65 DoT",
        "Soma Prime, Fully Spooled: 7.600 s, 1878 direct, 142 DoT",
        "Tigris Prime, Normal Attack: 0.500 s, 2559 direct, 0 DoT",
        "Hek, Normal Attack: 3.846 s, 2329 direct, 43 DoT",
        "Vectis, Normal Attack: 7.000 s, 1949 direct, 157 DoT",
        "Vectis Prime, Normal Attack: 2.825 s, 2361 direct, 45 DoT",
        "Paris, Uncharged Shot: 19.800 s, 2004 direct, 86 DoT",
        "Paris, Charged Shot: 7.400 s, 2216 direct, 47 DoT",
        "Burston, Normal Attack: 8.823 s, 1821 direct, 177 DoT",
        "Amprex, Normal Attack: 5.583 s, 1471 direct, 545 DoT",
        "Penta, Grenade Impact: 7.500 s, 2166 direct, 0 DoT",
        "Nagantaka Prime, Semi-Auto: 4.000 s, 1805 direct, 458 DoT",
        "Lex, Normal Attack: 19.469 s, 2008 direct, 41 DoT",
        "Kuva Nukor, Normal Attack: 6.500 s, 2015 direct, 0 DoT",
      ]
    `);
  });

  it.each(modes.map(({ name, weapon, attack }) => [name, weapon.id, attack.id]))(
    '%s has a series as long as the fight, which adds up to its damage',
    (_name, weaponId, attackId) => {
      const { series, lasted, direct, dot } = fightWith(weaponId, attackId);
      expect(series.direct).toHaveLength(Math.ceil(lasted / series.step - 1e-9));
      expect(series.dot).toHaveLength(series.direct.length);
      expect(series.direct.reduce((sum, damage) => sum + damage, 0)).toBeCloseTo(direct, 6);
      expect(series.dot.reduce((sum, damage) => sum + damage, 0)).toBeCloseTo(dot, 6);
      expect(direct).toBeGreaterThan(0);
    },
  );
});
