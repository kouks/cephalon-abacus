import { describe, expect, it } from 'vitest';

import type { Layer } from '@abacus/data/schema/damageTypeRule';

import { add, makeLibrary, mod } from '@/testing/build';
import { factorOf, hit, LAYER_RULES } from '@/testing/hit';
import { takenOfStacks } from '@/timeline/enemyState';

import { armorShare } from './defence';

const library = makeLibrary([]);

/** What these stacks of one status do to the hits that meet the enemy. */
const stacksOf = (status: string, stacks: number) => takenOfStacks([[status, stacks]], library);

const OPEN = { overguard: 1e9, shield: 1e9, health: Number.POSITIVE_INFINITY };

const meeting = (layer: Layer, change: object = {}) =>
  hit({
    attack: { critChance: 0 },
    defence: { layer, armor: 0, rules: LAYER_RULES, left: OPEN },
    ...change,
  });

const sourcesOf = ({ effects }: { readonly effects: readonly { readonly source: object }[] }) =>
  effects.map(({ source }) => source);

describe('Viral on the enemy (BIBLE §8)', () => {
  it('multiplies a hit on health: +100% at one stack, +325% at ten', () => {
    const plain = meeting('health').total;
    expect(meeting('health', { taken: stacksOf('virus', 1) }).total).toBeCloseTo(plain * 2, 9);
    expect(meeting('health', { taken: stacksOf('virus', 10) }).total).toBeCloseTo(plain * 4.25, 9);
  });

  it('is the amplifier factor, which names it', () => {
    const amplifier = factorOf(meeting('health', { taken: stacksOf('virus', 3) }), 'amplifier');
    expect(amplifier.value).toBeCloseTo(2.5, 12);
    expect(sourcesOf(amplifier)).toEqual([{ id: 'virus', name: 'virus' }]);
  });

  it('leaves shields and Overguard alone', () => {
    for (const layer of ['shield', 'overguard'] as const) {
      const viral = meeting(layer, { taken: stacksOf('virus', 10) });
      expect(viral.total).toBeCloseTo(meeting(layer).total, 9);
      expect(factorOf(viral, 'amplifier')).toMatchObject({ value: 1, effects: [] });
    }
  });

  it('amplifies the neutral dummy, which is bare health', () => {
    expect(hit({ taken: stacksOf('virus', 1) }).total).toBeCloseTo(hit().total * 2, 9);
  });
});

describe('Magnetic on the enemy', () => {
  it('multiplies a hit on shields and on Overguard, and leaves health alone', () => {
    const taken = stacksOf('disrupt', 10);
    for (const layer of ['shield', 'overguard'] as const) {
      expect(meeting(layer, { taken }).total).toBeCloseTo(meeting(layer).total * 4.25, 9);
    }
    expect(meeting('health', { taken }).total).toBeCloseTo(meeting('health').total, 9);
  });
});

describe('Corrosive on the enemy', () => {
  const armored = (taken: ReturnType<typeof stacksOf>, modules: readonly object[] = []) =>
    hit({
      attack: { critChance: 0 },
      defence: { layer: 'health', armor: 600, rules: LAYER_RULES, left: OPEN },
      modules: modules as never,
      taken,
    });

  it('strips 26% of what armor is left at one stack, and 6% more a stack, to 80% at ten', () => {
    expect([1, 3, 10].map((stacks) => armored(stacksOf('corrosion', stacks)).trace.armor)).toEqual([
      expect.closeTo(600 * 0.74, 9),
      expect.closeTo(600 * 0.62, 9),
      expect.closeTo(600 * 0.2, 9),
    ]);
  });

  it('comes after a strip of the most, and the armor factor names both', () => {
    const corroder = mod('corroder', [add('enemy.armor', -0.5)]);
    const both = armored(stacksOf('corrosion', 10), [corroder]);
    expect(both.trace.armor).toBeCloseTo(600 * 0.5 * 0.2, 9);
    const armor = factorOf(both, 'armor', 'impact');
    expect(armor.value).toBeCloseTo(armorShare(60), 12);
    expect(armor.effects.map(({ source }) => source.id)).toEqual(['corroder', 'corrosion']);
  });
});

describe('Puncture and Cold on the enemy', () => {
  const EXPLOSION = { critChance: 0.2, flags: ['canCrit', 'isAoE'] };

  it('Puncture adds 5% crit chance a stack to a direct hit, and none to an explosion', () => {
    const chance = (attack: object, stacks: number) =>
      hit({ attack, taken: stacksOf('weakened', stacks) }).crit.chance.value;
    expect(chance({ critChance: 0.2 }, 5)).toBeCloseTo(0.45, 12);
    expect(chance({ critChance: 0.2 }, 1)).toBeCloseTo(0.25, 12);
    expect(chance(EXPLOSION, 5)).toBeCloseTo(0.2, 12);
  });

  it('Cold adds crit damage to a direct hit, +1.0 once the enemy is frozen, and none to AoE', () => {
    const extra = (attack: object, stacks: number) =>
      hit({ attack, taken: stacksOf('freeze', stacks) }).crit.multiplier.value -
      hit({ attack }).crit.multiplier.value;
    expect(extra({}, 9)).toBeCloseTo(0.5, 12);
    expect(extra({}, 10)).toBeCloseTo(1, 12);
    expect(extra(EXPLOSION, 10)).toBe(0);
  });
});

describe('a status that does nothing to hits', () => {
  it('changes nothing: Bleed', () => {
    expect(stacksOf('bleed', 5)).toEqual([]);
    expect(hit({ taken: stacksOf('bleed', 5) }).total).toBeCloseTo(hit().total, 12);
  });
});
