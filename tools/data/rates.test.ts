import { describe, expect, it } from 'vitest';

import type { Weapon } from '#data/schema/weapon.ts';

import { realAttack, realLibrary as library } from './realAttack.ts';

type Modules = NonNullable<Parameters<typeof realAttack>[2]>['modules'];

const measure = (weaponId: string, attackId: string, modules: Modules = []) =>
  realAttack(weaponId, attackId, { modules });

const describeRates = ({ id, name, attacks }: Weapon) =>
  attacks.map((attack) => {
    const { effectiveFireRate, shotsPerMagazine, shootingProportion } = measure(
      id,
      attack.id,
    ).rates;
    const numbers = [effectiveFireRate, shotsPerMagazine, shootingProportion * 100];
    const [rate, shots, share] = numbers.map((value) => Number(value.toFixed(2)));
    return `${name}, ${attack.name}: ${rate}/s, ${shots} shots, shooting ${share}%`;
  });

describe('the seed weapons', () => {
  it('have an effective fire rate each', () => {
    expect([...library.weapons.values()].flatMap(describeRates)).toMatchInlineSnapshot(`
      [
        "Braton, Normal Attack: 8.75/s, 45 shots, shooting 72%",
        "Soma Prime, Fully Spooled: 15/s, 200 shots, shooting 81.63%",
        "Tigris Prime, Normal Attack: 2/s, 2 shots, shooting 35.71%",
        "Vectis Prime, Normal Attack: 2.67/s, 2 shots, shooting 61.22%",
        "Paris, Uncharged Shot: 1/s, 1 shots, shooting 60.61%",
        "Paris, Charged Shot: 0.87/s, 1 shots, shooting 100%",
        "Burston, Normal Attack: 9.32/s, 45 shots, shooting 70.72%",
        "Amprex, Normal Attack: 12/s, 200 shots, shooting 86.51%",
        "Penta, Grenade Impact: 1/s, 5 shots, shooting 66.67%",
        "Penta, Grenade Detonation: 1/s, Infinity shots, shooting 100%",
        "Nagantaka Prime, Semi-Auto: 2.5/s, 11 shots, shooting 65.67%",
        "Lex, Normal Attack: 1.08/s, 6 shots, shooting 70.21%",
        "Kuva Nukor, Normal Attack: 10/s, 154 shots, shooting 88.51%",
      ]
    `);
  });
});

describe('mods on real weapons', () => {
  it('Soma Prime with Point Strike has 75% crit chance', () => {
    const { critChance } = measure('soma-prime', 'normal', ['point-strike']).stats;
    expect(critChance.value).toBeCloseTo(0.75, 12);
  });

  it('Speed Trigger counts twice on Nagantaka Prime, which fires like a bow', () => {
    const { fireRate } = measure('nagantaka-prime', 'semi-auto', ['speed-trigger']).stats;
    expect(fireRate.value).toBeCloseTo(2.5 * 2.2, 12);
  });
});
