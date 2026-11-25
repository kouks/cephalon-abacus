import { describe, expect, it } from 'vitest';

import type { Weapon } from '#data/schema/weapon.ts';

import { realAttack, realLibrary as library } from './realAttack.ts';

const compose = (weaponId: string, attackId: string, modules: readonly string[] = []) =>
  realAttack(weaponId, attackId, { modules }).composition;

const describeDamage = ({ id, name, attacks }: Weapon) =>
  attacks.map((attack) => {
    const { moddedBase, types } = compose(id, attack.id);
    const each = [...types].map(([type, { damage, ratio }]) => {
      const raw = Number((ratio * moddedBase.value).toFixed(2));
      return `${type} ${raw} to ${Number(damage.toFixed(2))}`;
    });
    return `${name}, ${attack.name}: ${each.join(', ')}`;
  });

describe('the seed weapons', () => {
  it('have damage for every type, before and after quantization', () => {
    expect([...library.weapons.values()].flatMap(describeDamage)).toMatchInlineSnapshot(`
      [
        "Braton, Normal Attack: impact 7.92 to 8.25, puncture 7.92 to 8.25, slash 8.16 to 8.25",
        "Soma Prime, Fully Spooled: impact 1.2 to 1.13, puncture 4.8 to 4.88, slash 6 to 6",
        "Tigris Prime, Normal Attack: impact 19.5 to 18.28, puncture 19.5 to 18.28, slash 156 to 158.44",
        "Vectis, Normal Attack: impact 90 to 91.41, puncture 78.75 to 77.34, slash 56.25 to 56.25",
        "Vectis Prime, Normal Attack: impact 140 to 142.19, puncture 157.5 to 153.13, slash 52.5 to 54.69",
        "Paris, Uncharged Shot: impact 8 to 10, puncture 120 to 120, slash 32 to 30",
        "Paris, Charged Shot: impact 16 to 20, puncture 256 to 260, slash 48 to 50",
        "Burston, Normal Attack: impact 10 to 10.31, puncture 10 to 10.31, slash 10 to 10.31",
        "Amprex, Normal Attack: electricity 22 to 22",
        "Penta, Grenade Impact: impact 75 to 75",
        "Penta, Grenade Detonation: blast 350 to 350",
        "Nagantaka Prime, Semi-Auto: impact 1.73 to 0, puncture 15.57 to 16.22, slash 155.7 to 156.78",
        "Lex, Normal Attack: impact 13 to 12.19, puncture 104 to 105.63, slash 13 to 12.19",
        "Kuva Nukor, Normal Attack: radiation 21 to 21, magnetic 12.6 to 12.6",
      ]
    `);
  });
});
