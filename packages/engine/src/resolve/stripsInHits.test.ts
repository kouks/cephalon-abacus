import { describe, expect, it } from 'vitest';

import type { Layer } from '@abacus/data/schema/damageTypeRule';

import { add, mod } from '@/testing/build';
import { factorOf, hit, LAYER_RULES } from '@/testing/hit';

import { armorShare } from './defence';

/** Nothing in the way of the layer a hit meets. */
const OPEN = { overguard: 0, shield: 0, health: Number.POSITIVE_INFINITY };

const CORRODER = mod('corroder', [add('enemy.armor', -0.5)]);

const WARD = mod('ward', [add('enemy.damage', -0.9, { op: 'MULTIPLY' })]);

const meeting = (layer: Layer, armor: number, change: object = {}) =>
  hit({
    attack: { critChance: 0 },
    defence: { layer, armor, rules: LAYER_RULES, left: OPEN },
    ...change,
  });

describe('a strip on the enemy', () => {
  it('lowers the armor a hit meets, and the armor factor names it', () => {
    const stripped = meeting('health', 600, { modules: [CORRODER] });
    const armor = factorOf(stripped, 'armor', 'impact');
    expect(armor.value).toBeCloseTo(armorShare(300), 12);
    expect(armor.effects.map(({ source }) => source.id)).toEqual(['corroder']);
    expect(stripped.trace.armor).toBe(300);
  });

  it('leaves shields alone, and names nothing there', () => {
    const shield = meeting('shield', 600, { modules: [CORRODER] });
    expect(factorOf(shield, 'armor', 'impact')).toMatchObject({ value: 1, effects: [] });
    expect(shield.total).toBeCloseTo(meeting('shield', 600).total, 12);
  });

  it('has no armor to show on the neutral dummy', () => {
    expect(hit({ modules: [CORRODER] }).trace.armor).toBeUndefined();
  });
});

describe('a reduction of what the enemy takes', () => {
  it('multiplies the whole hit, and names what made it', () => {
    const warded = meeting('health', 0, { modules: [WARD] });
    expect(warded.total).toBeCloseTo(meeting('health', 0).total * 0.1, 9);
    const reduction = factorOf(warded, 'reduction');
    expect(reduction.value).toBeCloseTo(0.1, 12);
    expect(reduction.effects.map(({ source }) => source.id)).toEqual(['ward']);
  });

  it('comes after the least of 1 that armor leaves, so it has none of its own', () => {
    const attack = { damage: { impact: 5 }, critChance: 0 };
    const warded = meeting('health', 2700, { modules: [WARD], attack });
    expect(warded.total).toBeCloseTo(0.1, 9);
    expect(warded.tiers[0]?.total).toBeCloseTo(0.1, 9);
    expect(warded.trace.factors.at(-1)?.name).toBe('reduction');
  });

  it('is 1, naming nothing, when nothing reduces', () => {
    expect(factorOf(meeting('health', 0), 'reduction')).toMatchObject({ value: 1, effects: [] });
  });
});
