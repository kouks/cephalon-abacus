import { describe, expect, it } from 'vitest';

import { add } from '@/testing/build';
import { attackWith, measureCrit } from '@/testing/crit';

const MULTIPLICATIVE = { critStacking: 'multiplicative' };
const SET = { op: 'OVERRIDE' };

const flat = (value: number, change: object = {}) =>
  add('crit.chanceFlat', value, { op: 'ADD', ...change });

const bloodRush = add('crit.chanceCombo', { value: 0.4, times: ['comboTier'] });
const trueSteel = add('crit.chance', 1.2);
const pointStrike = add('crit.chance', 1.5);
const acuity = add('crit.chanceWeakPoint', 3.5);

const chance = (setup: Parameters<typeof measureCrit>[0]) => measureCrit(setup).chance.value;

describe('crit chance', () => {
  it('is the attack’s own without bonuses', () => {
    expect(chance({ attack: attackWith(0.2) })).toBe(0.2);
  });

  it('gram crit chance at 7x combo is 69%', () => {
    const effects = [trueSteel, bloodRush];
    expect(chance({ attack: attackWith(0.15), effects, combo: 7 })).toBeCloseTo(0.69, 12);
  });

  it('gram crit chance without combo is 33%', () => {
    const effects = [trueSteel, bloodRush];
    expect(chance({ attack: attackWith(0.15), effects })).toBeCloseTo(0.33, 12);
  });

  it('braton crit chance with Point Strike and Argon Scope is 46.2%', () => {
    const effects = [pointStrike, add('crit.chance', 1.35)];
    expect(chance({ attack: attackWith(0.12), effects })).toBeCloseTo(0.462, 12);
  });

  it('braton crit chance with Point Strike and Arcane Avenger is 75%', () => {
    const effects = [flat(0.45), pointStrike];
    expect(chance({ attack: attackWith(0.12), effects })).toBeCloseTo(0.75, 12);
  });

  it('never drops below zero', () => {
    expect(chance({ effects: [add('crit.chance', -1.5)] })).toBe(0);
  });

  it('stays at zero for an attack that can’t crit, whatever is added', () => {
    const { chance: none } = measureCrit({ effects: [flat(0.45)], attack: { flags: [] } });
    expect(none).toEqual({ base: 0.2, value: 0, totals: [] });
  });
});

describe('weak point crit chance', () => {
  const build = { attack: attackWith(0.5), effects: [add('crit.chance', 2), acuity] };

  it('counts on weak points only', () => {
    expect(chance(build)).toBeCloseTo(1.5, 12);
    expect(chance({ ...build, bodyParts: ['head'] })).toBeCloseTo(1.5, 12);
  });

  it('adds up with the other bonuses', () => {
    const onWeakPoint = { ...build, bodyParts: ['head', 'weakPoint'] as const };
    expect(chance(onWeakPoint)).toBeCloseTo(0.5 * (1 + 2 + 3.5), 12);
    const weaponChange = { critStacking: 'additive' };
    expect(chance({ ...onWeakPoint, weaponChange })).toBeCloseTo(3.25, 12);
  });

  it('kuva chakkhurr crit chance, stacking multiplicatively, is 675%', () => {
    const onWeakPoint = { ...build, bodyParts: ['weakPoint'] as const };
    expect(chance({ ...onWeakPoint, weaponChange: MULTIPLICATIVE })).toBeCloseTo(6.75, 12);
    expect(chance({ ...build, weaponChange: MULTIPLICATIVE })).toBeCloseTo(1.5, 12);
  });

  it('adds flat chance last, however it stacks', () => {
    const effects = [...build.effects, flat(0.2)];
    const all = { ...build, effects, bodyParts: ['weakPoint'] as const };
    expect(chance({ ...all, weaponChange: MULTIPLICATIVE })).toBeCloseTo(6.95, 12);
    expect(chance(all)).toBeCloseTo(3.45, 12);
  });
});

describe('a set crit chance', () => {
  it('ignores every other bonus: Crystallize, 300%', () => {
    const effects = [pointStrike, flat(0.45), add('crit.chance', 3, SET)];
    expect(chance({ effects })).toBe(3);
  });

  it('holds wherever it is written, and the highest wins', () => {
    expect(chance({ effects: [flat(3, SET), pointStrike] })).toBe(3);
    expect(chance({ effects: [flat(3, SET), add('crit.chance', 0.5, SET)] })).toBe(3);
  });

  it('can be zero', () => {
    expect(chance({ effects: [pointStrike, flat(0, SET)] })).toBe(0);
  });
});
