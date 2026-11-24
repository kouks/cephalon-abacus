import { describe, expect, it } from 'vitest';

import { add } from '@/testing/build';
import { measure } from '@/testing/stats';

const AMMO = { magazine: 45, maxAmmo: 540, reloadStyle: 'magazine', reloadTime: 2 };
/** 2x as the game stores it. */
const TWO = (256 * 32) / 4095;
const AOE = { radius: 4, centerPct: 1, edgePct: 0.5, losRequired: false };

const statsWith = (...effects: readonly object[]) => measure({ effects }).stats;

describe('attack stats', () => {
  it('are the weapon’s own without mods', () => {
    const { critChance, critMultiplier, statusChance, multishot, fireRate } = measure().stats;
    const values = [critChance, critMultiplier, statusChance, multishot, fireRate];
    expect(values.map(({ value }) => value)).toEqual([0.2, TWO, 0.1, 1, 8]);
  });

  it.each([
    ['critChance', 'crit.chance', 1.5, 0.5],
    ['critMultiplier', 'crit.damage', 1.2, TWO * 2.2],
    ['statusChance', 'status.chance', 0.9, 0.19],
    ['statusDuration', 'status.duration', 0.9, 1.9],
    ['multishot', 'multishot', 0.9, 1.9],
    ['fireRate', 'fireRate', 0.6, 12.8],
    ['magazine', 'magazine', 0.4, 63],
    ['maxAmmo', 'ammoMax', 0.3, 702],
    ['reloadTime', 'reload', 0.3, 2 / 1.3],
  ] as const)('%s follows %s', (...[stat, bucket, bonus, expected]) => {
    expect(statsWith(add(bucket, bonus))[stat]?.value).toBeCloseTo(expected, 12);
  });

  it('add flat status chance after percentages: 10% x 1.9 + 20%', () => {
    const { statusChance } = statsWith(
      add('status.chanceFlat', 0.2, { op: 'ADD' }),
      add('status.chance', 0.9),
    );
    expect(statusChance.value).toBeCloseTo(0.39, 12);
    expect(statusChance.totals.map(({ bucket }) => bucket)).toEqual([
      'status.chance',
      'status.chanceFlat',
    ]);
  });

  it.each([
    [11, 0.3, 14],
    [2, 0.3, 3],
    [6, 0.3, 8],
    [1, -0.6, 1],
  ])('round a magazine of %d with %d to %d', (...[magazine, bonus, expected]) => {
    const weaponChange = { ammo: { ...AMMO, magazine } };
    const { stats } = measure({ effects: [add('magazine', bonus)], weaponChange });
    expect(stats.magazine?.value).toBe(expected);
  });

  it('include flat crit bonuses: Arcane Avenger and Tenacious Bond', () => {
    const { critChance, critMultiplier } = statsWith(
      add('crit.chanceFlat', 0.45, { op: 'ADD' }),
      add('crit.damageFlat', 1.2, { op: 'ADD' }),
    );
    expect(critChance.value).toBeCloseTo(0.65, 12);
    expect(critMultiplier.value).toBeCloseTo(TWO + 1.2, 12);
  });

  it('add punch through in metres', () => {
    const flat = add('punchThrough', 1.2, { op: 'ADD' });
    expect(statsWith(flat).punchThrough.value).toBeCloseTo(1.2, 12);
    const { stats } = measure({ effects: [flat], attack: { punchThrough: 1 } });
    expect(stats.punchThrough.value).toBeCloseTo(2.2, 12);
  });

  it('cap ammo efficiency at 75%', () => {
    const { ammoEfficiency } = statsWith(add('ammoEfficiency', 0.9, { op: 'ADD' }));
    expect(ammoEfficiency.value).toBe(0.75);
  });

  it('mod range, speed and radius only where the attack has them', () => {
    const effects = ['range', 'projectileSpeed', 'aoeRadius'].map((bucket) => add(bucket, 0.5));
    const bare = measure({ effects }).stats;
    expect([bare.range, bare.projectileSpeed, bare.aoeRadius]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    const attack = { range: 18, projectileSpeed: 70, shotType: 'aoe', aoe: AOE };
    const { range, projectileSpeed, aoeRadius } = measure({ effects, attack }).stats;
    expect([range, projectileSpeed, aoeRadius].map((stat) => stat?.value)).toEqual([27, 105, 6]);
  });

  it('of an explosion leave out bonuses for direct hits only', () => {
    const effects = [add('crit.chance', 1, { scope: ['direct'] }), add('crit.chance', 0.5)];
    expect(measure({ effects }).stats.critChance.value).toBeCloseTo(0.5, 12);
    const explosion = { shotType: 'aoe', aoe: AOE, flags: ['canCrit', 'isAoE'] };
    const { critChance } = measure({ effects, attack: explosion }).stats;
    expect(critChance.value).toBeCloseTo(0.3, 12);
  });

  it('keep the base and the effects behind each stat', () => {
    const { critChance } = statsWith(add('crit.chance', 1.5));
    expect(critChance.base).toBe(0.2);
    expect(critChance.totals[0]?.contributions.map(({ value }) => value)).toEqual([1.5]);
  });

  it('refill a battery after its delay: 1 s + 45 ÷ 10', () => {
    const battery = { magazine: 45, reloadStyle: 'battery', regenRate: 10, regenDelay: 1 };
    const { stats } = measure({ weaponChange: { ammo: battery } });
    expect(stats.reloadTime?.value).toBeCloseTo(5.5, 12);
  });

  it('never finish a reload at a speed of zero', () => {
    const { stats } = measure({ effects: [add('reload', -1)], weaponChange: { ammo: AMMO } });
    expect(stats.reloadTime?.value).toBe(Number.POSITIVE_INFINITY);
  });

  it('leave ammo out for weapons without it', () => {
    const { stats, rates } = measure({ weaponChange: { ammo: undefined } });
    expect([stats.magazine, stats.reloadTime, stats.maxAmmo]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(rates.shootingProportion).toBe(1);
  });
});

describe('fire rate', () => {
  const CHARGE = { trigger: 'charge', chargeTime: 0.5, afterCharge: 'reload' };

  it('caps a semi-automatic at 10/s before bonuses, not after', () => {
    const fast = { trigger: 'semi', fireRate: 15 };
    expect(measure({ attack: fast }).stats.fireRate.value).toBe(10);
    const { fireRate } = measure({ attack: fast, effects: [add('fireRate', 0.6)] }).stats;
    expect(fireRate.value).toBeCloseTo(16, 12);
  });

  it('does not cap an automatic', () => {
    expect(measure({ attack: { fireRate: 15 } }).stats.fireRate.value).toBe(15);
  });

  it('never goes below zero', () => {
    expect(statsWith(add('fireRate', -1.5)).fireRate.value).toBe(0);
  });

  it('shortens a charge: base ÷ (1 + bonus)', () => {
    const { chargeTime } = measure({ attack: CHARGE, effects: [add('fireRate', 0.6)] }).stats;
    expect(chargeTime?.value).toBeCloseTo(0.3125, 12);
  });

  it('counts twice on what fires like a bow, unless the rule is off', () => {
    const setup = {
      attack: CHARGE,
      effects: [add('fireRate', 0.6)],
      weaponChange: { fireRateBonusScale: 2 },
    };
    expect(measure(setup).stats.chargeTime?.value).toBeCloseTo(0.5 / 2.2, 12);
    const off = measure({ ...setup, assumptions: { bowFireRateDoubled: false } });
    expect(off.stats.chargeTime?.value).toBeCloseTo(0.3125, 12);
  });

  it('counts a penalty twice too', () => {
    const { fireRate } = measure({
      effects: [add('fireRate', -0.2)],
      weaponChange: { fireRateBonusScale: 2 },
    }).stats;
    expect(fireRate.value).toBeCloseTo(8 * 0.6, 12);
  });

  it.each([
    [-0.9, 5],
    [-0.95, 5],
    [-0.5, 1],
  ])('%d stretches a charge to %d s, ten times its base at most', (bonus, expected) => {
    const { chargeTime } = measure({ attack: CHARGE, effects: [add('fireRate', bonus)] }).stats;
    expect(chargeTime?.value).toBeCloseTo(expected, 12);
  });
});
