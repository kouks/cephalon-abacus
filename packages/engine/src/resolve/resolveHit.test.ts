import { describe, expect, it } from 'vitest';

import type { DamageType } from '@abacus/data/schema/damageType';

import { add, mod, SERRATION } from '@/testing/build';
import { elementMod, physicalMod } from '@/testing/composition';
import { factorOf, HEAD, hit, makeFaction, makeTarget } from '@/testing/hit';
import type { FactorName } from '@/trace/hitTrace';

const VITAL_SENSE = mod('vital-sense', [add('crit.damage', 1.2)]);
const POINT_STRIKE = mod('point-strike', [add('crit.chance', 1.5)]);
const TWO = (256 * 32) / 4095;
const WHITE = 103.125;

const CHARGER = makeTarget({
  faction: makeFaction({ damageProfile: { slash: 1.5, heat: 1.5, puncture: 0.5 } }),
});

const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

describe('a hit on a neutral target', () => {
  it('deals its quantized damage, times its average crit', () => {
    const { total, perType } = hit();
    expect(total).toBeCloseTo(WHITE * (1 + 0.2 * (TWO - 1)), 9);
    expect([...perType.keys()]).toEqual(['impact', 'puncture', 'slash']);
    expect(sum(perType.values())).toBeCloseTo(total, 9);
  });

  it('has every factor of the chain, in order', () => {
    const names = hit().trace.factors.map(({ name, type }) =>
      type === undefined ? name : `${name} ${type}`,
    );
    expect(names).toEqual([
      'base',
      'share impact',
      'share puncture',
      'share slash',
      'faction',
      'crit',
      'bodyPart',
      'range',
      'falloff',
      'vulnerability impact',
      'vulnerability puncture',
      'vulnerability slash',
      'layer',
      'armor',
      'reduction',
    ]);
  });

  it('lands on health, at once, without procs', () => {
    const { t, pellet, layer, procs } = hit().trace;
    expect([t, pellet, layer, procs]).toEqual([0, 0, 'health', []]);
  });

  it('shows what each crit tier would', () => {
    const modules = [POINT_STRIKE, VITAL_SENSE];
    const { tiers, crit, total } = hit({ modules, attack: { critChance: 0.5 } });
    expect(crit.chance.value).toBeCloseTo(1.25, 12);
    expect(tiers.map(({ tier, chance }) => [tier, chance])).toEqual([
      [1, 0.75],
      [2, 0.25],
    ]);
    const [yellow, orange] = tiers.map((entry) => entry.total);
    expect(yellow).toBeCloseTo(WHITE * TWO * 2.2, 9);
    expect(orange).toBeCloseTo(WHITE * (1 + 2 * (TWO * 2.2 - 1)), 9);
    expect(sum(tiers.map((entry) => entry.chance * entry.total))).toBeCloseTo(total, 9);
  });
});

describe('a hit’s factors', () => {
  it('know the faction’s weaknesses and resistances', () => {
    const result = hit({ target: CHARGER });
    const types = ['impact', 'puncture', 'slash'] as const;
    const values = types.map((type) => factorOf(result, 'vulnerability', type).value);
    expect(values).toEqual([1, 0.5, 1.5]);
    expect((result.perType.get('slash') ?? 0) / (hit().perType.get('slash') ?? 1)).toBe(1.5);
  });

  it('know the head: 3x, and twice the crit multiplier', () => {
    const { tiers } = hit({}, HEAD);
    expect(tiers[0]?.total).toBeCloseTo(3 * WHITE, 9);
    expect(tiers[1]?.total).toBeCloseTo(3 * WHITE * TWO * 2, 9);
  });

  it('keep damage, physical and elemental bonuses apart', () => {
    const maim = physicalMod('maim', 'slash', 1.2);
    const cold = elementMod('cold', 'cold');
    const toxin = elementMod('toxin', 'toxin');
    const result = hit({ modules: [SERRATION, maim, cold, toxin] });
    const namesIn = (name: FactorName, type?: DamageType) =>
      factorOf(result, name, type).effects.map(({ source }) => source.name);
    expect(namesIn('base')).toEqual(['serration']);
    expect(namesIn('share', 'slash')).toEqual(['maim']);
    expect(namesIn('share', 'viral')).toEqual(['cold', 'toxin']);
    expect(namesIn('share', 'impact')).toEqual([]);
    expect(factorOf(result, 'base').value).toBeCloseTo(265, 12);
    expect(factorOf(result, 'share', 'viral').value).toBe(58 / 32);
  });

  it('name both kinds of crit bonus', () => {
    const { effects, value } = factorOf(hit({ modules: [POINT_STRIKE, VITAL_SENSE] }), 'crit');
    expect(effects.map(({ source }) => source.name)).toEqual(['point-strike', 'vital-sense']);
    expect(value).toBeCloseTo(1 + 0.5 * (TWO * 2.2 - 1), 12);
  });

  it('leave a removed type at zero', () => {
    const result = hit({ modules: [physicalMod('riven', 'slash', -1.17)] });
    expect(result.perType.get('slash')).toBe(0);
  });
});
