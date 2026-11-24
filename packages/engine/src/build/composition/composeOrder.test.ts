import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { buff, compose, elementMod, perType, sourcesOf } from '@/testing/composition';

const CRYO = elementMod('cryo-rounds', 'cold');
const HELLFIRE = elementMod('hellfire', 'heat');
const TOXIN = elementMod('infected-clip', 'toxin');
const ELECTRICITY = { electricity: 22 };

/** The ratios of the elements, which is all these tests are about. */
const ratios = (setup: Parameters<typeof compose>[0]) =>
  perType(compose({ damage: ELECTRICITY, ...setup }), 'ratio');

describe('the order of elements', () => {
  const modules = [HELLFIRE, CRYO, TOXIN];

  it('is the order of the modules', () => {
    expect(ratios({ modules })).toEqual({ blast: 1.8, corrosive: 1.9 });
    expect(ratios({ modules: [CRYO, TOXIN, HELLFIRE] })).toEqual({ viral: 1.8, radiation: 1.9 });
    expect(ratios({ modules: [HELLFIRE, TOXIN, CRYO] })).toEqual({ gas: 1.8, magnetic: 1.9 });
  });

  it('is what elementOrder says, whatever the order of the modules', () => {
    const elementOrder = ['cryo-rounds', 'infected-clip', 'hellfire'];
    expect(ratios({ modules, build: { elementOrder } })).toEqual({ viral: 1.8, radiation: 1.9 });
  });

  it('puts modules that elementOrder leaves out after those it names', () => {
    const build = { elementOrder: ['infected-clip'] };
    expect(ratios({ modules, build })).toEqual({ gas: 1.8, magnetic: 1.9 });
  });

  it('keeps what a Riven lists last first, even when another mod shares an element', () => {
    const riven = mod('riven', [add('damage.element.heat', 0.5), add('damage.element.cold', 0.5)], {
      kind: 'riven',
    });
    const build = { elementOrder: ['riven', 'infected-clip', 'cryo-rounds'] };
    const hit = compose({ damage: ELECTRICITY, modules: [CRYO, TOXIN, riven], build });
    const placed = sourcesOf(hit).map(
      ({ name, origin, element }) => `${name}, ${origin}: ${element}`,
    );
    expect(placed).toEqual([
      'riven, riven: cold',
      'cryo-rounds, mod: cold',
      'riven, riven: heat',
      'infected-clip, mod: toxin',
      'test-rifle, innate: electricity',
    ]);
    expect(perType(hit, 'ratio')).toEqual({ blast: 1.9, corrosive: 1.9 });
  });

  it('puts a weapon’s own bonus last, among its innate elements', () => {
    const weaponChange = { innatePassives: [add('damage.element.toxin', 0.5)] };
    const physical = ratios({ damage: { slash: 100 }, modules: [HELLFIRE, CRYO], weaponChange });
    expect(physical).toEqual({ slash: 1, blast: 1.8, toxin: 0.5 });
    const innate = ratios({ damage: { heat: 100 }, modules: [CRYO], weaponChange });
    expect(innate).toEqual({ blast: 1.9, toxin: 0.5 });
  });

  it('leaves an ability’s element out: its Heat never combines with Cold', () => {
    const hit = ratios({ damage: { slash: 100 }, modules: [CRYO, buff('fireball', 'heat', 0.5)] });
    expect(hit).toEqual({ slash: 1, cold: 0.9, heat: 0.5 });
  });

  it('can lose damage to rounding when a bonus re-pairs the elements', () => {
    const pair = [elementMod('heat', 'heat', 0.51), elementMod('cold', 'cold', 0.51)];
    const sliver = elementMod('toxin', 'toxin', 0.001);
    const steps = (modules: readonly { id: string }[]) =>
      perType(compose({ damage: { slash: 100 }, modules }), 'quantized');
    expect(steps(pair)).toEqual({ slash: 1, blast: 33 / 32 });
    expect(steps([sliver, ...pair])).toEqual({ slash: 1, gas: 16 / 32, cold: 16 / 32 });
  });

  it('puts a modifier of the mission after the modules', () => {
    const library = [HELLFIRE, CRYO, TOXIN];
    const hit = compose({
      damage: { slash: 100 },
      modules: library,
      mission: ['hellfire'],
    });
    expect(perType(hit, 'ratio')).toEqual({ slash: 1, viral: 1.8, heat: 0.9 });
  });
});

describe('a progenitor', () => {
  const NUKOR = { progenitor: { element: 'magnetic', pct: 0.6 } };
  const damage = { radiation: 20 };

  it('is base damage of its element', () => {
    const hit = compose({ damage, weaponChange: NUKOR });
    expect(hit.moddedBase.base).toBeCloseTo(32, 12);
    expect(perType(hit)).toEqual({ magnetic: 12, radiation: 20 });
    const origins = sourcesOf(hit).map(({ element, origin }) => `${element}: ${origin}`);
    expect(origins).toEqual(['radiation: innate', 'magnetic: progenitor']);
  });

  it('raises what elemental mods add', () => {
    const hit = compose({ damage, weaponChange: NUKOR, modules: [HELLFIRE] });
    expect(hit.types.get('heat')?.damage).toBeCloseTo(32 * (29 / 32), 12);
  });

  it('can be swapped by the build', () => {
    const build = { progenitor: { element: 'toxin', pct: 0.25 } };
    const hit = compose({ damage, weaponChange: NUKOR, build });
    expect(perType(hit, 'ratio')).toEqual({ toxin: 0.2, radiation: 0.8 });
    expect(hit.warnings).toEqual([]);
  });

  it('of Impact is a physical type that bonuses scale', () => {
    const weaponChange = { progenitor: { element: 'impact', pct: 0.6 } };
    const crash = mod('crash-course', [add('damage.ips.impact', 1)]);
    const hit = compose({ damage, weaponChange, modules: [crash] });
    expect(perType(hit)).toEqual({ impact: 24, radiation: 20 });
  });

  it('adds to a physical type the attack already has', () => {
    const weaponChange = { progenitor: { element: 'impact', pct: 0.6 } };
    const hit = compose({ damage: { impact: 10, slash: 10 }, weaponChange });
    expect(hit.physical.get('impact')?.base).toBeCloseTo(22 / 32, 12);
  });

  it('is refused by a weapon that has none', () => {
    const build = { progenitor: { element: 'toxin', pct: 0.4 } };
    const hit = compose({ damage, build });
    expect(perType(hit)).toEqual({ radiation: 20 });
    expect(hit.warnings).toEqual([{ code: 'noProgenitor', weaponId: 'test-rifle' }]);
  });
});

it('warns of an element order that names something else', () => {
  const build = { elementOrder: ['hellfire', 'serration', 'riven'] };
  const serration = mod('serration', [add('damage.base', 1.65)]);
  const { warnings } = compose({ modules: [HELLFIRE, serration], build });
  expect(warnings).toEqual([
    { code: 'unusedElement', sourceId: 'serration' },
    { code: 'unusedElement', sourceId: 'riven' },
  ]);
});
