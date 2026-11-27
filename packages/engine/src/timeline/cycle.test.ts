import { describe, expect, it } from 'vitest';

import { add } from '@/testing/build';
import { scheduleOf, shotsPerSecond } from '@/testing/schedule';
import type { Setup } from '@/testing/stats';
import { measure } from '@/testing/stats';

import { cycleOf } from './cycle';

const CHARGE = { trigger: 'charge', fireRate: 2, chargeTime: 0.5 };
const BURST = { trigger: 'burst', fireRate: 5, burstCount: 3, burstDelay: 0.061 };
const HIDES = {
  ammo: { magazine: 2, reloadStyle: 'magazine', reloadTime: 1, reloadHidesDelay: true },
};

const cycleFor = (setup: Setup) => {
  const { weapon, ...built } = measure(setup);
  return cycleOf(weapon, built);
};

describe('a firing mode’s cycle', () => {
  it('is the test rifle’s: 8 shots a second, 45 to a magazine, 2 s to reload', () => {
    expect(cycleFor({})).toEqual({
      charge: 0,
      burst: { count: 1, delay: 0 },
      delay: 0.125,
      magazine: 45,
      reload: 2,
      hidesDelay: false,
    });
  });

  it.each([
    ['the fire delay', 'fireDelay', 0.5],
    ['nothing, after a reload', 'reload', 0],
    ['nothing at all', 'none', 0],
  ])('waits %s after a charged shot', (_name, afterCharge, delay) => {
    expect(cycleFor({ attack: { ...CHARGE, afterCharge } })).toMatchObject({ charge: 0.5, delay });
  });

  it('fires a burst at its delay, then waits the fire delay', () => {
    expect(cycleFor({ attack: BURST })).toMatchObject({
      burst: { count: 3, delay: 0.061 },
      delay: 0.2,
    });
  });

  it('has the modded stats: a faster fire rate, magazine and reload', () => {
    const effects = [add('fireRate', 0.6), add('magazine', 0.3), add('reload', 0.25)];
    expect(cycleFor({ effects })).toMatchObject({ delay: 1 / 12.8, magazine: 58, reload: 1.6 });
  });

  it('has the reload hide the last delay where the weapon says so', () => {
    expect(cycleFor({ weaponChange: HIDES })).toMatchObject({ magazine: 2, hidesDelay: true });
  });

  it.each([
    ['auto', {}, {}],
    ['charge, then the fire delay', { ...CHARGE, afterCharge: 'fireDelay' }, {}],
    ['charge, then a reload', { ...CHARGE, afterCharge: 'reload' }, {}],
    ['burst', BURST, {}],
    ['a reload that hides the last delay', {}, HIDES],
  ])('fires as many shots a second as the closed form: %s', (_name, attack, weaponChange) => {
    const { weapon, ...built } = measure({ attack, weaponChange });
    const { effectiveFireRate, shootingProportion } = built.rates;
    const events = scheduleOf(cycleOf(weapon, built), 300);
    expect(shotsPerSecond(events)).toBeCloseTo(effectiveFireRate * shootingProportion, 9);
  });
});
