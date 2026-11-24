import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';

import { GALVANIZED_CHAMBER, makeLibrary, makeScenario, PRIMARY_ACUITY } from '@/testing/build';

import { buildAttack } from './buildAttack';
import { NO_VARIABLES } from './contributions';
import { makeLoadout } from './loadout';

const load = (module: { readonly id: string }) => {
  const scenario = makeScenario([{ moduleId: module.id }]);
  const loadout = makeLoadout(scenario, makeLibrary([module]));
  return { loadout, attack: must(loadout.weapon.attacks[0], 'no attack') };
};

describe('a built attack', () => {
  it('has the stats, rates and damage of the build', () => {
    const { loadout, attack } = load(GALVANIZED_CHAMBER);
    const { stats, rates, composition } = buildAttack(loadout, attack);
    expect(stats.multishot.value).toBeCloseTo(1.8, 12);
    expect(rates.effectiveFireRate).toBe(8);
    expect(composition.moddedBase.value).toBe(100);
  });

  it('is of a moment: two stacks of Galvanized Chamber', () => {
    const { loadout, attack } = load(GALVANIZED_CHAMBER);
    const stacks = new Map([['galvanized-chamber onKill', 2]]);
    const moment = { stacks, variables: NO_VARIABLES };
    const { stats } = buildAttack(loadout, attack, { moment });
    expect(stats.multishot.value).toBeCloseTo(1 + 0.8 + 2 * 0.3, 12);
  });

  it('is for a body part: Acuity on a weak point', () => {
    const { loadout, attack } = load(PRIMARY_ACUITY);
    const chance = (bodyParts: readonly ('head' | 'weakPoint')[]) =>
      buildAttack(loadout, attack, { bodyParts }).stats.critChance.value;
    expect(chance(['weakPoint'])).toBeCloseTo(0.9, 12);
    expect(chance([])).toBeCloseTo(0.2, 12);
  });
});

it('a weapon has to exist', () => {
  const scenario = makeScenario([], { weaponId: 'nothing' });
  expect(() => makeLoadout(scenario, makeLibrary([]))).toThrow('No weapon "nothing"');
});
