import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import { scenarioSchema } from '#data/schema/scenario.ts';
import type { Weapon } from '#data/schema/weapon.ts';
import { scenario } from '#data/testing/fixtures.ts';
import { DEFAULT_ASSUMPTIONS } from '#engine/assumptions.ts';
import { collectEffects } from '#engine/build/collectEffects.ts';
import { composeDamage } from '#engine/build/composition/composeDamage.ts';
import { selectionOf } from '#engine/build/selectEffects.ts';
import { contributionsTo, sumBuckets } from '#engine/build/totalBuckets.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();

const compose = (weaponId: string, attackId: string, modules: readonly string[] = []) => {
  const weapon = must(library.weapons.get(weaponId), `No weapon "${weaponId}"`);
  const attack = must(
    weapon.attacks.find(({ id }) => id === attackId),
    `No attack "${attackId}"`,
  );
  const equipped = modules.map((moduleId) => ({ moduleId }));
  const { build } = scenarioSchema.parse({
    ...scenario,
    build: { ...scenario.build, weaponId, modules: equipped },
  });
  const collected = collectEffects({ ...scenarioSchema.parse(scenario), build }, library);
  const contributions = contributionsTo(collected, library, {
    selection: selectionOf(weapon, attack),
  });
  const composition = composeDamage(weapon, attack, {
    build,
    library,
    contributions,
    totals: sumBuckets(contributions, library),
    assumptions: DEFAULT_ASSUMPTIONS,
  });
  return { ...composition, warnings: collected.warnings };
};

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

/** White body damage to a Charger, which takes 1.5x from Slash and Heat. */
const onCharger = (...args: Parameters<typeof compose>) => {
  const hits = [...compose(...args).types].map(([type, { damage }]) =>
    type === 'slash' || type === 'heat' ? damage * 1.5 : damage,
  );
  return Math.round(hits.reduce((sum, damage) => sum + damage, 0));
};

/** What the arsenal shows: damage before quantization. */
const inArsenal = (...args: Parameters<typeof compose>) => {
  const { moddedBase, types } = compose(...args);
  return [...types].map(
    ([type, { ratio }]) => `${type} ${Number((ratio * moddedBase.value).toFixed(1))}`,
  );
};

describe('as measured in the game', () => {
  it('T-1: Braton deals 29 to a Charger', () => {
    expect(onCharger('braton', 'normal')).toBe(29);
  });

  it('T-2: Nagantaka Prime deals 251, 666 with Serration and 257 with Crash Course', () => {
    expect(onCharger('nagantaka-prime', 'semi-auto')).toBe(251);
    expect(onCharger('nagantaka-prime', 'semi-auto', ['serration'])).toBe(666);
    expect(onCharger('nagantaka-prime', 'semi-auto', ['crash-course'])).toBe(257);
  });

  it.each([
    [
      ['hellfire', 'cryo-rounds', 'infected-clip'],
      ['blast 39.6', 'corrosive 41.8'],
    ],
    [
      ['cryo-rounds', 'infected-clip', 'hellfire'],
      ['viral 39.6', 'radiation 41.8'],
    ],
    [
      ['hellfire', 'infected-clip', 'cryo-rounds'],
      ['gas 39.6', 'magnetic 41.8'],
    ],
  ])('T-3: Amprex with %j', (modules, expected) => {
    expect(inArsenal('amprex', 'normal', modules)).toEqual(expected);
  });
});
