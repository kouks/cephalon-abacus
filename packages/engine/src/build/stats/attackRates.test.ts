import { describe, expect, it } from 'vitest';

import { add } from '@/testing/build';
import { measure } from '@/testing/stats';

const BURST = { trigger: 'burst', fireRate: 5, burstCount: 3, burstDelay: 0.061 };
const CHARGE = { trigger: 'charge', fireRate: 2, chargeTime: 0.5 };
const SPOOL = { trigger: 'autoSpool', spool: { shotsToMax: 4, startRate: 0.25 } };

const rateOf = (attack: object, ...effects: readonly object[]) =>
  measure({ attack, effects }).rates.effectiveFireRate;

describe('effective fire rate', () => {
  it.each([
    ['semi', { trigger: 'semi' }, 8],
    ['auto', { trigger: 'auto' }, 8],
    ['autoSpool, at full speed', SPOOL, 8],
    ['held', { trigger: 'held' }, 8],
    ['duplex', { trigger: 'duplex' }, 8],
    ['active', { trigger: 'active' }, 8],
    ['burst', BURST, 3 / (0.2 + 2 * 0.061)],
    ['charge, then the fire delay', { ...CHARGE, afterCharge: 'fireDelay' }, 1 / (0.5 + 0.5)],
    ['charge, then a reload', { ...CHARGE, afterCharge: 'reload' }, 1 / (0.5 + 2)],
    ['charge, then nothing', { ...CHARGE, afterCharge: 'none' }, 2],
  ])('%s', (_name, attack, expected) => {
    expect(rateOf(attack)).toBeCloseTo(expected, 12);
  });

  it('is 9.3168 for Burston: 5/s, 3 shots, 0.061 s apart', () => {
    expect(rateOf(BURST)).toBeCloseTo(9.3168, 4);
  });

  it('speeds up a whole burst, delays included', () => {
    expect(rateOf(BURST, add('fireRate', 0.6))).toBeCloseTo(9.3168 * 1.6, 3);
  });

  it('does not stretch the delays of a slowed burst', () => {
    expect(rateOf(BURST, add('fireRate', -0.5))).toBeCloseTo(3 / (0.4 + 2 * 0.061), 12);
  });
});

describe('ammo', () => {
  it('gives shots per magazine: 45 ÷ 1', () => {
    expect(measure().rates.shotsPerMagazine).toBe(45);
  });

  it('counts what a shot costs and what efficiency saves', () => {
    expect(measure({ attack: { ammoCost: 0.5 } }).rates.shotsPerMagazine).toBe(90);
    const effects = [add('ammoEfficiency', 0.75, { op: 'ADD' })];
    expect(measure({ effects }).rates.shotsPerMagazine).toBeCloseTo(180, 10);
  });

  it('never runs out when a shot is free', () => {
    const { shotsPerMagazine, shootingProportion } = measure({ attack: { ammoCost: 0 } }).rates;
    expect([shotsPerMagazine, shootingProportion]).toEqual([Number.POSITIVE_INFINITY, 1]);
  });

  it('gives the share of time spent shooting: 45 ÷ (45 + 8 x 2)', () => {
    expect(measure().rates.shootingProportion).toBeCloseTo(45 / 61, 12);
  });

  it('takes one shot off when the reload hides the last delay: Vectis', () => {
    const ammo = {
      magazine: 2,
      reloadStyle: 'magazine',
      reloadTime: 0.85,
      reloadHidesDelay: true,
    };
    const { rates } = measure({ attack: { fireRate: 2 }, weaponChange: { ammo } });
    expect(rates.shootingProportion).toBeCloseTo(2 / (1 + 1.7), 12);
  });

  it('does not count a bow’s reload twice', () => {
    const attack = { ...CHARGE, afterCharge: 'reload' };
    expect(measure({ attack }).rates.shootingProportion).toBe(1);
  });

  it('counts the reload of other charged weapons', () => {
    const attack = { ...CHARGE, afterCharge: 'none' };
    expect(measure({ attack }).rates.shootingProportion).toBeCloseTo(45 / (45 + 2 * 2), 12);
  });
});
