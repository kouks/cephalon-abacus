import { describe, expect, it } from 'vitest';

import type { DamageType } from '@abacus/data/schema/damageType';
import type { DamageTypeRule, Layer } from '@abacus/data/schema/damageTypeRule';

import { factorOf, hit } from '@/testing/hit';

const TWO = (256 * 32) / 4095;
const WHITE = 103.125;

const rule = (layers: DamageTypeRule['layers'], bypassArmor = false) =>
  ({ layers, bypassArmor }) as unknown as DamageTypeRule;

const ALL = { overguard: 1, shield: 1, health: 1 };

/** The test rifle's three types, as damageTypes.json has them, and a few others. */
const RULES = new Map<DamageType, DamageTypeRule>([
  ['impact', rule(ALL)],
  ['puncture', rule(ALL)],
  ['slash', rule(ALL)],
  ['toxin', rule({ overguard: 1, health: 1 })],
  ['void', rule({ ...ALL, overguard: 1.5 })],
  ['true', rule({ overguard: 1, health: 1 }, true)],
]);

const meeting = (layer: Layer, armor = 0, attack: object = {}) =>
  hit({ attack, defence: { layer, armor, rules: RULES } });

const perTypeOf = (layer: Layer, damage: object, armor = 0) =>
  Object.fromEntries(
    [...meeting(layer, armor, { damage, critChance: 0 }).perType].map(([type, value]) => [
      type,
      Number(value.toFixed(6)),
    ]),
  );

describe('a layer', () => {
  it('takes what each type does to it', () => {
    expect(perTypeOf('shield', { impact: 50, toxin: 50 })).toEqual({ impact: 50, toxin: 0 });
    expect(perTypeOf('health', { impact: 50, toxin: 50 })).toEqual({ impact: 50, toxin: 50 });
    expect(perTypeOf('overguard', { void: 100 })).toEqual({ void: 150 });
  });

  it('is in the trace, type by type', () => {
    const toxin = meeting('shield', 0, { damage: { impact: 50, toxin: 50 } });
    expect(factorOf(toxin, 'layer', 'toxin').value).toBe(0);
    expect(toxin.trace.layer).toBe('shield');
  });
});

describe('armor', () => {
  it('lowers health damage by its square root: 300 leaves 70%', () => {
    expect(meeting('health', 300).total).toBeCloseTo(0.7 * meeting('health').total, 9);
    expect(factorOf(meeting('health', 300), 'armor', 'impact').value).toBeCloseTo(0.7, 12);
  });

  it('leaves shields and Overguard alone', () => {
    expect(meeting('shield', 2700).total).toBeCloseTo(meeting('shield').total, 9);
    expect(meeting('overguard', 2700).total).toBeCloseTo(meeting('overguard').total, 9);
  });

  it('leaves True damage alone', () => {
    expect(perTypeOf('health', { true: 100, impact: 100 }, 2700)).toEqual({
      impact: 10,
      true: 100,
    });
  });

  /** 6.25, 6.25 and 90.625 after quantization: a tenth of that under 2,700 armor. */
  const WEAK = { impact: 5, puncture: 5, slash: 90 };

  it('leaves each type it reduces at least 1, at every crit tier', () => {
    const weak = meeting('health', 2700, { damage: WEAK });
    const [white, yellow] = weak.tiers.map(({ total }) => total);
    expect(white).toBeCloseTo(1 + 1 + 9.0625, 9);
    expect(yellow).toBeCloseTo(2 * 0.625 * TWO + 9.0625 * TWO, 9);
    expect(factorOf(weak, 'least', 'impact').value).toBeGreaterThan(1);
    expect(factorOf(weak, 'least', 'slash').value).toBe(1);
  });

  it('keeps a type’s damage the product of its factors, the least too', () => {
    const weak = meeting('health', 2700, { damage: WEAK });
    for (const [type, damage] of weak.perType) {
      const own = weak.trace.factors.filter((entry) => (entry.type ?? type) === type);
      expect(own.reduce((product, { value }) => product * value, 1)).toBeCloseTo(damage, 9);
    }
  });

  it('gives no least to a type that quantization took to nothing', () => {
    const tiny = meeting('health', 2700, { damage: { impact: 0.1, slash: 100 } });
    expect(tiny.perType.get('impact')).toBe(0);
    expect(tiny.tiers[0]?.total).toBeCloseTo(100.1 * 0.1, 9);
  });

  it('gives no least to a type it doesn’t reduce, or that deals nothing', () => {
    const shield = meeting('shield', 2700, { damage: { impact: 0.1, toxin: 0.1 } });
    expect(shield.tiers[0]?.total).toBeCloseTo(0.1, 9);
    expect(factorOf(shield, 'least', 'toxin').value).toBe(1);
  });
});

it('without a defence, a hit meets bare health', () => {
  const plain = hit();
  expect(plain.total).toBeCloseTo(WHITE * (1 + 0.2 * (TWO - 1)), 9);
  expect(plain.trace.layer).toBe('health');
});
