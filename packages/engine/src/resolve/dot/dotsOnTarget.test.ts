import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';
import type { Layer } from '@abacus/data/schema/damageTypeRule';

import { add, makeLibrary, mod } from '@/testing/build';
import { factorOf, HEAD, hit, LAYER_RULES, makeFaction, makeTarget } from '@/testing/hit';
import { takenOfStacks } from '@/timeline/enemyState';
import type { DotTrace } from '@/trace/hitTrace';

import { armorShare } from '../defence';

const OPEN = { overguard: 1e9, shield: 1e9, health: 1e9 };
const always = (damage: object) => ({ damage, statusChance: 1, critChance: 0 });

/** The first DoT of a hit on a layer, with that much armor on health. */
const meeting = (layer: Layer, damage: object, change: object = {}) =>
  must(
    hit({
      attack: always(damage),
      defence: { layer, armor: 600, rules: LAYER_RULES, left: OPEN },
      ...change,
    }).trace.dots[0],
    'A DoT',
  );

const valueOf = (dot: DotTrace, name: string) =>
  must(
    dot.factors.find((factor) => factor.name === name),
    `No ${name}`,
  ).value;

describe('a tick at the target', () => {
  it('of Slash is Cinematic damage, which armor doesn’t reduce', () => {
    expect(valueOf(meeting('health', { slash: 40 }), 'armor')).toBe(1);
    expect(valueOf(meeting('health', { toxin: 40 }), 'armor')).toBeCloseTo(armorShare(600), 12);
  });

  it('of Toxin goes past shields to health, where armor takes its share', () => {
    const toxin = meeting('shield', { toxin: 40 });
    expect([valueOf(toxin, 'layer'), valueOf(toxin, 'armor')]).toEqual([1, armorShare(600)]);
    expect(valueOf(meeting('shield', { slash: 40 }), 'armor')).toBe(1);
  });

  it('takes Viral on health, as hits do', () => {
    const taken = takenOfStacks([['virus', 10]], makeLibrary([]));
    expect(valueOf(meeting('health', { slash: 40 }, { taken }), 'amplifier')).toBe(4.25);
    expect(valueOf(meeting('shield', { slash: 40 }, { taken }), 'amplifier')).toBe(1);
  });

  it('takes no faction weakness, unless T-8 says so', () => {
    const target = makeTarget({ faction: makeFaction({ damageProfile: { slash: 1.5 } }) });
    expect(valueOf(meeting('health', { slash: 40 }, { target }), 'vulnerability')).toBe(1);
    const assumptions = { dotsTakeTypeWeakness: true };
    const weak = meeting('health', { slash: 40 }, { target, assumptions });
    expect(valueOf(weak, 'vulnerability')).toBe(1.5);
    expect(
      factorOf(hit({ attack: always({ slash: 40 }), target }), 'vulnerability', 'slash').value,
    ).toBe(1.5);
  });

  it('is the same on the neutral dummy as on bare health', () => {
    const bare = must(hit({ attack: always({ toxin: 40 }) }).trace.dots[0], 'A DoT');
    expect(bare.damage).toBeCloseTo(20.5, 9);
  });
});

describe('a proc’s seed', () => {
  const dotsOf = (attack: object, change: object = {}) =>
    hit({ attack: { ...always({ slash: 40 }), ...attack }, ...change }).trace.dots;

  it('has each crit tier’s multiplier, quantized as the hit’s', () => {
    const tiers = dotsOf({ critChance: 0.25, critMultiplier: 2 });
    expect(tiers.map(({ tier, chance, seed }) => [tier, chance, seed])).toEqual([
      [0, 0.75, 40],
      [1, 0.25, expect.closeTo(40 * 2.0005, 3)],
    ]);
  });

  it('has the body part’s multiplier', () => {
    const [onHead] = hit({ attack: always({ slash: 40 }) }, HEAD).trace.dots;
    expect(onHead?.seed).toBe(120);
  });

  it('has the base damage mods, and no type mods', () => {
    const serration = mod('serration', [add('damage.base', 1.65)]);
    const toxic = mod('toxic', [add('damage.element.toxin', 0.9)]);
    expect(dotsOf({}, { modules: [serration, toxic] })[0]?.seed).toBeCloseTo(106, 9);
  });

  it('is a share of a proc in expected value, and only DoTs have one', () => {
    expect(dotsOf({ statusChance: 0.4 }).map(({ count }) => count)).toEqual([0.4]);
    expect(hit({ attack: always({ impact: 40 }) }).trace.dots).toEqual([]);
  });

  it('ticks for longer with status duration', () => {
    const lasting = mod('lasting', [add('status.duration', 0.3)]);
    expect(dotsOf({}, { modules: [lasting] })[0]?.times).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('has the final multipliers, as a hit does', () => {
    const eclipse = mod('eclipse', [add('damage.final.eclipse', 0.5, { op: 'MULTIPLY' })]);
    expect(dotsOf({}, { modules: [eclipse] })[0]?.seed).toBeCloseTo(60, 9);
  });

  it('falls off from an explosion’s centre, as its hit does', () => {
    const explosion = {
      shotType: 'aoe',
      aoe: { radius: 4, centerPct: 1, edgePct: 0.5, losRequired: false },
      flags: ['isAoE'],
    };
    const near = hit({ attack: { ...always({ slash: 40 }), ...explosion }, missBy: 2 });
    const falloff = factorOf(near, 'radialFalloff').value;
    expect(falloff).toBeLessThan(1);
    expect(near.trace.dots[0]?.seed).toBeCloseTo(40 * falloff, 9);
  });
});

describe('a hit that doesn’t get to the target', () => {
  it('inflicts no procs, so it leaves no DoT: beyond its range, or a shot that misses', () => {
    const attack = { ...always({ slash: 40 }), range: 10 };
    expect(hit({ attack, distance: 11 }).trace).toMatchObject({ procs: [], dots: [] });
    expect(hit({ attack: always({ slash: 40 }), missBy: 1 }).trace).toMatchObject({
      procs: [],
      dots: [],
    });
    expect(hit({ attack, distance: 10 }).trace.procs).toEqual([{ status: 'bleed', count: 1 }]);
  });
});
