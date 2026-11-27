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
      const { timeToKill, direct } = fightWith(weapon.id, attack.id);
      const killed = timeToKill === undefined ? 'lives' : `${timeToKill.toFixed(3)} s`;
      return `${name}: ${killed}, ${Math.round(direct)} damage`;
    });
    expect(lines).toMatchInlineSnapshot(`
      [
        "Braton, Normal Attack: 12.057 s, 2002 damage",
        "Soma Prime, Fully Spooled: 8.067 s, 2008 damage",
        "Tigris Prime, Normal Attack: 0.500 s, 2559 damage",
        "Hek, Normal Attack: 3.846 s, 2329 damage",
        "Vectis, Normal Attack: 8.000 s, 2197 damage",
        "Vectis Prime, Normal Attack: 2.825 s, 2361 damage",
        "Paris, Uncharged Shot: 21.450 s, 2159 damage",
        "Paris, Charged Shot: 7.400 s, 2216 damage",
        "Burston, Normal Attack: 9.467 s, 1999 damage",
        "Amprex, Normal Attack: 7.667 s, 2011 damage",
        "Penta, Grenade Impact: 7.500 s, 2166 damage",
        "Nagantaka Prime, Semi-Auto: 7.100 s, 2136 damage",
        "Lex, Normal Attack: 20.392 s, 2128 damage",
        "Kuva Nukor, Normal Attack: 6.500 s, 2015 damage",
      ]
    `);
  });

  it.each(modes.map(({ name, weapon, attack }) => [name, weapon.id, attack.id]))(
    '%s has a series as long as the fight, which adds up to its damage',
    (_name, weaponId, attackId) => {
      const { series, lasted, direct } = fightWith(weaponId, attackId);
      expect(series.direct).toHaveLength(Math.ceil(lasted / series.step - 1e-9));
      expect(series.direct.reduce((sum, damage) => sum + damage, 0)).toBeCloseTo(direct, 6);
      expect(direct).toBeGreaterThan(0);
    },
  );
});
