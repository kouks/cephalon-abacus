import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';

import { add, mod } from '@/testing/build';
import { hit, makeFaction, makeTarget } from '@/testing/hit';

/** The proc's tier-0 entry of a hit that always procs its one type, and never crits. */
const dotOf = (damage: object, change: object = {}) =>
  must(
    hit({ attack: { damage, statusChance: 1, critChance: 0 }, ...change }).trace.dots[0],
    'A DoT',
  );

const GRINEER = makeTarget({ faction: makeFaction({ factionModGroup: 'grineer' }) });
const bane = (value: number) => mod('bane', [add('damage.faction.grineer', value)]);
const element = (type: string, value: number) => mod(type, [add(`damage.element.${type}`, value)]);

describe('the wiki’s worked ticks (Damage/Calculation), before target defences', () => {
  it('heat with +60%: (40 + 1) × 0.5 × 1.6 = 32.8', () => {
    expect(dotOf({ heat: 40 }, { modules: [element('heat', 0.6)] }).damage).toBeCloseTo(32.8, 5);
  });

  it('electricity with +150%: (40 + 1) × 0.5 × 2.5 = 51.25', () => {
    const tick = dotOf({ electricity: 40 }, { modules: [element('electricity', 1.5)] });
    expect(tick.damage).toBeCloseTo(51.25, 5);
  });

  it('toxin with +225% and Primed Bane: (40 × 1.55 + 1) × 0.5 × 3.25 × 1.55 = 158.68', () => {
    const modules = [element('toxin', 2.25), bane(0.55)];
    const tick = dotOf({ toxin: 40 }, { modules, target: GRINEER });
    expect(tick.seed).toBeCloseTo(62, 9);
    expect(tick.damage).toBeCloseTo(158.68, 2);
  });

  it('gas with nothing: (40 + 1) × 0.5 = 20.5', () => {
    expect(dotOf({ gas: 40 }).damage).toBeCloseTo(20.5, 9);
  });

  it('slash with Primed Bane: (40 × 1.55 + 1) × 0.35 × 1.55 = 34.18', () => {
    const tick = dotOf({ slash: 40 }, { modules: [bane(0.55)], target: GRINEER });
    expect(tick.damage).toBeCloseTo(34.18, 2);
  });
});

describe('the faction double-dip (the wiki’s Slash page)', () => {
  const ratio = (value: number) =>
    dotOf({ slash: 1000 }, { modules: [bane(value)], target: GRINEER }).damage /
    dotOf({ slash: 1000 }, { target: GRINEER }).damage;

  it('is about 1.69x for 30% and 2.4025x for 55%, the 1 aside', () => {
    expect(ratio(0.3)).toBeCloseTo(1.69, 2);
    expect(ratio(0.55)).toBeCloseTo(2.4025, 2);
  });

  it('is faction in the seed, and faction in the tick', () => {
    const tick = dotOf({ slash: 1000 }, { modules: [bane(0.3)], target: GRINEER });
    const faction = tick.factors.filter(({ name }) => name === 'faction');
    expect([tick.seed, faction.map(({ value }) => value)]).toEqual([1300, [1.3]]);
  });
});

describe('what a tick takes, and what it doesn’t', () => {
  it('is in binary32 on the attacker’s side, as the game works it', () => {
    expect(dotOf({ toxin: 40 }, { modules: [element('toxin', 2.25)] }).damage).toBe(
      Math.fround(Math.fround(41 * 0.5) * 3.25),
    );
  });

  it('takes status damage bonuses, which only procs have', () => {
    const elementalist = mod('elementalist', [add('status.damage', 0.9)]);
    const tick = dotOf({ slash: 40 }, { modules: [elementalist] });
    expect(tick.damage).toBeCloseTo(41 * 0.35 * 1.9, 5);
    expect(hit({ attack: { damage: { slash: 40 } }, modules: [elementalist] }).total).toBeCloseTo(
      hit({ attack: { damage: { slash: 40 } } }).total,
      9,
    );
  });

  it('takes only its own element’s mods: Sawtooth Clip doesn’t raise a bleed', () => {
    const sawtooth = mod('sawtooth', [add('damage.ips.slash', 0.9)]);
    expect(dotOf({ slash: 40 }, { modules: [sawtooth] }).damage).toBeCloseTo(41 * 0.35, 5);
    expect(dotOf({ toxin: 40 }, { modules: [element('heat', 0.9)] }).damage).toBeCloseTo(20.5, 9);
  });

  it('gives Gas Gas mods alone, unless T-8 says its components count too', () => {
    const modules = [element('heat', 0.6), element('toxin', 0.6), element('gas', 0.5)];
    expect(dotOf({ gas: 40 }, { modules }).damage).toBeCloseTo(41 * 0.5 * 1.5, 5);
    const assumptions = { dotsTakeComponentBonuses: true };
    expect(dotOf({ gas: 40 }, { modules, assumptions }).damage).toBeCloseTo(41 * 0.5 * 2.7, 5);
  });

  it('names every factor of the formula, in order', () => {
    const names = dotOf({ toxin: 40 }).factors.map(({ name, type }) =>
      type === undefined ? name : `${name} ${type}`,
    );
    expect(names).toEqual([
      'seed',
      'coefficient',
      'element',
      'faction',
      'statusDamage',
      'vulnerability toxin',
      'layer toxin',
      'armor toxin',
      'amplifier',
      'reduction',
    ]);
  });
});
