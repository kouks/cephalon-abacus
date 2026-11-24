import { describe, expect, it } from 'vitest';

import { add, mod, SERRATION } from '@/testing/build';
import { buff, compose, elementMod, perType, physicalMod, sourcesOf } from '@/testing/composition';

const NAGANTAKA = { impact: 1.73, puncture: 15.57, slash: 155.7 };
const CRYO = elementMod('cryo-rounds', 'cold');
const HELLFIRE = elementMod('hellfire', 'heat');
const TOXIN = elementMod('infected-clip', 'toxin');
const PIERCING_CALIBER = physicalMod('piercing-caliber', 'puncture', 1.2);

describe('an attack without mods', () => {
  it('of 30 impact, 30 puncture and 40 slash deals 31.25, 31.25 and 40.625', () => {
    const hit = compose();
    expect(perType(hit)).toEqual({ impact: 31.25, puncture: 31.25, slash: 40.625 });
    expect(perType(hit, 'ratio')).toEqual({ impact: 0.3, puncture: 0.3, slash: 0.4 });
    expect(hit.moddedBase).toMatchObject({ base: 100, value: 100 });
    expect(hit.elements).toEqual([]);
  });

  it('loses 1.73 impact of 173 damage', () => {
    const hit = compose({ damage: NAGANTAKA });
    expect(perType(hit)).toEqual({ impact: 0, puncture: 16.21875, slash: 156.78125 });
    expect(hit.types.get('impact')?.ratio).toBeCloseTo(0.01, 12);
  });

  it('keeps an innate secondary element as it is', () => {
    const hit = compose({ damage: { blast: 350 }, modules: [HELLFIRE] });
    expect(perType(hit)).toEqual({ heat: 350 * (29 / 32), blast: 350 });
  });

  it('keeps types that are neither physical nor elemental', () => {
    expect(perType(compose({ damage: { void: 100 } }))).toEqual({ void: 100 });
  });
});

describe('physical bonuses', () => {
  it('with Maim, 40 slash is 87.5', () => {
    const maim = physicalMod('maim', 'slash', 1.2);
    expect(perType(compose({ modules: [maim] }))).toEqual({
      impact: 31.25,
      puncture: 31.25,
      slash: 87.5,
    });
  });

  it('do nothing for a type the attack lacks', () => {
    const hit = compose({ damage: { impact: 75 }, modules: [physicalMod('maim', 'slash', 1.2)] });
    expect(perType(hit)).toEqual({ impact: 75 });
  });

  it('are traced to their mods', () => {
    const hit = compose({ modules: [PIERCING_CALIBER] });
    const { base, totals } = hit.physical.get('puncture') ?? {};
    expect(base).toBe(0.3);
    expect(totals?.[0]?.contributions.map(({ source, value }) => [source.name, value])).toEqual([
      ['piercing-caliber', 1.2],
    ]);
    expect(hit.physical.get('slash')?.totals[0]?.contributions).toEqual([]);
  });

  it('can take a type to zero, or below', () => {
    const slash = (value: number) =>
      compose({ modules: [physicalMod('riven', 'slash', value)] }).types.get('slash');
    expect(slash(-0.98)).toMatchObject({ quantized: 0, damage: 0 });
    expect(slash(-1.17)?.quantized).toBe(-2 / 32);
  });
});

describe('elemental bonuses', () => {
  it('are shares of all base damage', () => {
    expect(perType(compose({ modules: [HELLFIRE] }))).toMatchObject({ heat: 100 * (29 / 32) });
  });

  it('are quantized as one sum: 90% Cold and 90% Toxin are 180% Viral', () => {
    const hit = compose({ modules: [CRYO, TOXIN] });
    expect(hit.types.get('viral')).toEqual({ ratio: 1.8, quantized: 58 / 32, damage: 181.25 });
    expect(2 * (29 / 32)).toBe(58 / 32);
    const uneven = compose({ modules: [CRYO, elementMod('malignant-force', 'toxin', 0.6)] });
    expect(uneven.types.get('viral')?.quantized).toBe(48 / 32);
  });

  it('that never combine join their like: 90% Radiation and Smite Infusion are 180%', () => {
    const isotope = elementMod('accelerated-isotope', 'radiation');
    const hit = compose({ modules: [isotope, buff('smite', 'radiation', 0.9)] });
    expect(hit.types.get('radiation')).toMatchObject({ ratio: 1.8, quantized: 58 / 32 });
    const apart = compose({ modules: [HELLFIRE, buff('smite', 'radiation', 0.9)] });
    expect(perType(apart, 'ratio')).toMatchObject({ heat: 0.9, radiation: 0.9 });
  });

  it('nagantaka prime with five bonuses deals 951.5', () => {
    const hit = compose({
      damage: NAGANTAKA,
      modules: [
        CRYO,
        elementMod('malignant-force', 'toxin', 0.6),
        HELLFIRE,
        PIERCING_CALIBER,
        buff('valence-formation', 'gas', 2),
      ],
    });
    const damage = perType(hit);
    expect(damage).toEqual({
      impact: 0,
      puncture: 32.4375,
      slash: 156.78125,
      viral: 259.5,
      heat: 156.78125,
      gas: 346,
    });
    expect(Object.values(damage).reduce((sum, value) => sum + value, 0)).toBe(951.5);
  });

  it('explain themselves', () => {
    const hit = compose({ modules: [CRYO, TOXIN] });
    expect(sourcesOf(hit).map(({ name }) => name)).toEqual(['cryo-rounds', 'infected-clip']);
  });

  it('count with the stacks of their switch', () => {
    const stacking = add('damage.element.heat', 0.3, {
      condition: { trigger: 'onKill', target: 'self' },
    });
    const modules = [mod('stacking', [stacking])];
    const on = compose({ modules, build: { conditionals: { all: 'on', overrides: [] } } });
    expect(on.types.get('heat')?.ratio).toBe(0.3);
    expect(compose({ modules }).types.has('heat')).toBe(false);
  });
});

describe('damage bonuses', () => {
  const modules = [SERRATION, HELLFIRE, PIERCING_CALIBER];

  it('multiply every quantized type, and leave the ratios alone', () => {
    const plain = compose({ modules: [HELLFIRE, PIERCING_CALIBER] });
    const strong = compose({ modules });
    expect(perType(strong, 'quantized')).toEqual(perType(plain, 'quantized'));
    for (const [type, { damage }] of strong.types) {
      expect(damage).toBeCloseTo((plain.types.get(type)?.damage ?? 0) * 2.65, 9);
    }
  });

  it('make the modded base that statuses use, without elements or physical bonuses', () => {
    const { moddedBase } = compose({ modules });
    expect(moddedBase.value).toBeCloseTo(265, 12);
    expect(moddedBase.totals[0]?.contributions.map(({ source }) => source.name)).toEqual([
      'serration',
    ]);
  });

  it('never take it below zero', () => {
    const hit = compose({ modules: [mod('riven', [add('damage.base', -1.5)])] });
    expect(hit.moddedBase.value).toBe(0);
  });
});

describe('proc weights', () => {
  const weights = (setup: Parameters<typeof compose>[0]) =>
    Object.fromEntries(compose(setup).procWeights);

  it('are the quantized shares, so a type at zero has none', () => {
    expect(weights({ damage: NAGANTAKA })).toEqual({ puncture: 3 / 32, slash: 29 / 32 });
  });

  it('would be the raw shares if T-14 had said so', () => {
    const raw = weights({ damage: NAGANTAKA, assumptions: { procWeightsQuantized: false } });
    expect(raw['impact']).toBeCloseTo(0.01, 12);
    expect(raw['slash']).toBeCloseTo(0.9, 12);
  });

  it('leave out a type below zero', () => {
    const modules = [physicalMod('riven', 'slash', -1.17)];
    expect(weights({ modules })).toEqual({ impact: 10 / 32, puncture: 10 / 32 });
  });
});
