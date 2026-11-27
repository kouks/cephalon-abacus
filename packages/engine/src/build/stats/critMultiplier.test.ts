import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { add } from '@/testing/build';
import { attackWith, measureCrit } from '@/testing/crit';

import { quantizeCritMultiplier } from './critMultiplier';

const STEP = 32 / 4095;
const VITAL_SENSE = add('crit.damage', 1.2);
const HEAD = { location: { headcrit: 2 } };

const flat = (value: number) => add('crit.damageFlat', value, { op: 'ADD' });
const final = (value: number) => add('crit.damageFinal', value, { op: 'MULTIPLY' });

const multiplier = (setup: Parameters<typeof measureCrit>[0]) =>
  measureCrit(setup).multiplier.value;

/** A weapon's crit multiplier with these effects. */
const of = (critMultiplier: number, ...effects: readonly object[]) =>
  multiplier({ attack: attackWith(0.2, critMultiplier), effects });

describe('the base crit multiplier', () => {
  it('braton with Critical Parallel has 2x, which is code 256', () => {
    expect(quantizeCritMultiplier(1.6 + 0.4)).toBeCloseTo(256 * STEP, 12);
  });

  it.each([
    [0, 0],
    [1.6, 205],
    [2.2, 282],
    [3, 384],
    [3.2, 410],
    [32, 4095],
    [40, 4095],
  ])('%d is %d steps', (base, steps) => {
    expect(quantizeCritMultiplier(base)).toBeCloseTo(steps * STEP, 12);
  });

  it('moves by at most half a step', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 32, noNaN: true }), (base) => {
        expect(Math.abs(quantizeCritMultiplier(base) - base)).toBeLessThanOrEqual(STEP / 2 + 1e-9);
      }),
    );
  });
});

describe('crit damage', () => {
  it('is quantized before mods, not after', () => {
    expect(of(1.6)).toBeCloseTo(205 * STEP, 12);
    expect(of(1.6, VITAL_SENSE)).toBeCloseTo(205 * STEP * 2.2, 12);
  });

  it('braton crit damage with Vital Sense and Bladed Rounds is 5.44x', () => {
    const expected = quantizeCritMultiplier(1.6) * (1 + 1.2 + 1.2);
    expect(of(1.6, VITAL_SENSE, add('crit.damage', 1.2))).toBeCloseTo(expected, 12);
    expect(expected).toBeCloseTo(5.44, 1);
  });

  it('braton crit damage with Vital Sense and Tenacious Bond is 4.72x', () => {
    expect(of(1.6, flat(1.2), VITAL_SENSE)).toBeCloseTo(205 * STEP * 2.2 + 1.2, 12);
    expect(of(1.6, flat(1.2), VITAL_SENSE)).toBeCloseTo(4.72, 2);
  });

  it('is doubled by Electric Shield, after everything else', () => {
    expect(of(2, VITAL_SENSE, flat(0.5), final(1))).toBeCloseTo((256 * STEP * 2.2 + 0.5) * 2, 12);
  });

  it('never drops below zero', () => {
    expect(of(2, add('crit.damage', -1.5))).toBe(0);
  });

  it('is 1x for an attack that can’t crit', () => {
    const { base, value } = measureCrit({ attack: { critMultiplier: 0, flags: [] } }).multiplier;
    expect([base, value]).toEqual([1, 1]);
  });
});

describe('Cold', () => {
  const cold = { attack: attackWith(0.2, 1.6), effects: [add('crit.damage', 1.1)], coldStacks: 9 };

  it('kunai crit damage with Primed Target Cracker and 9 Cold stacks is 3.86x', () => {
    expect(multiplier(cold)).toBeCloseTo(205 * STEP * 2.1 + 0.5, 12);
    expect(multiplier(cold)).toBeCloseTo(3.86, 2);
  });

  it('is a share of the base if T-5 says so', () => {
    const assumptions = { coldCritDamageAbsolute: false };
    expect(multiplier({ ...cold, assumptions })).toBeCloseTo(205 * STEP * (1 + 1.1 + 0.5), 12);
  });

  it.each([true, false])('does not reach AoE (absolute: %s)', (coldCritDamageAbsolute) => {
    const explosion = { ...cold.attack, flags: ['canCrit', 'isAoE'] };
    const assumptions = { coldCritDamageAbsolute };
    const value = multiplier({ ...cold, attack: explosion, assumptions });
    expect(value).toBeCloseTo(205 * STEP * 2.1, 12);
  });

  it('leaves other flat crit damage to AoE: Tenacious Bond', () => {
    const attack = { ...cold.attack, flags: ['canCrit', 'isAoE'] };
    expect(multiplier({ ...cold, attack, effects: [flat(1.2)] })).toBeCloseTo(205 * STEP + 1.2, 12);
  });
});

describe('a headcrit', () => {
  const build = { attack: attackWith(0.2, 2), effects: [VITAL_SENSE, flat(0.5)], ...HEAD };
  const base = 256 * STEP;

  it.each([
    ['the modded multiplier and flat bonuses', {}, (base * 2.2 + 0.5) * 2],
    ['only the modded multiplier', { headcritScalesFlat: false }, base * 2.2 * 2 + 0.5],
    ['only the base', { headcritScalesModded: false }, base * (2 + 1.2) + 0.5],
  ])('multiplies %s', (_name, assumptions, expected) => {
    expect(multiplier({ ...build, assumptions })).toBeCloseTo(expected, 12);
  });

  it('is not always 2x: Juggernaut’s maw has 4x, and Ropalolyst’s head 0.2x', () => {
    const on = (headcrit: number) => multiplier({ ...build, location: { headcrit } });
    expect(on(4)).toBeCloseTo((base * 2.2 + 0.5) * 4, 12);
    expect(on(0.2)).toBeCloseTo((base * 2.2 + 0.5) * 0.2, 12);
  });

  it.each([{}, { headcritScalesFlat: false }, { headcritScalesModded: false }])(
    'changes nothing at 1x (%o)',
    (assumptions) => {
      const value = multiplier({ ...build, assumptions, location: { headcrit: 1 } });
      expect(value).toBeCloseTo(base * 2.2 + 0.5, 12);
    },
  );

  it('comes before the final multipliers', () => {
    const effects = [...build.effects, final(1)];
    const assumptions = { headcritScalesModded: false };
    const value = multiplier({ ...build, effects, assumptions });
    expect(value).toBeCloseTo((base * (2 + 1.2) + 0.5) * 2, 12);
  });
});
