import { describe, expect, expectTypeOf, it } from 'vitest';

import { attack, module, scenario, weapon } from '@/testing/fixtures';

import type { Attack } from './attack';
import { conditionSchema } from './condition';
import type { DamageMap, DamageType } from './damageType';
import { DAMAGE_TYPES } from './damageType';
import { effectSchema, spawnInstanceSchema } from './effect';
import { goldenFixtureSchema } from './goldenFixture';
import { moduleSchema } from './module';
import { hookRefSchema, sourceSchema } from './primitives';
import { scenarioSchema } from './scenario';
import type { Weapon } from './weapon';
import { weaponSchema } from './weapon';
import type { WeaponClass } from './weaponClass';

const accepts = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('damage types', () => {
  it('are the 20 the wiki lists', () => {
    expect(new Set(DAMAGE_TYPES).size).toBe(20);
  });
});

describe('types', () => {
  it('are deeply readonly', () => {
    expectTypeOf<Weapon['attacks']>().toEqualTypeOf<readonly Attack[]>();
    expectTypeOf<Weapon['class']>().toEqualTypeOf<readonly WeaponClass[]>();
    expectTypeOf<DamageMap>().toEqualTypeOf<Readonly<Partial<Record<DamageType, number>>>>();
  });
});

describe('sources', () => {
  it.each([
    ['https://wiki.warframe.com/w/Serration', true],
    ['https://www.warframe.com/patch-notes/pc/44-1-3', true],
    ['https://warframe.fandom.com/wiki/Serration', false],
    ['https://fandom.com', false],
    ['https://notfandom.com/x', true],
    ['ftp://wiki.warframe.com', false],
  ])('%s: %s', (url, isValid) => {
    expect(accepts(sourceSchema, url)).toBe(isValid);
  });
});

describe('effects', () => {
  const effect = { bucket: 'damage.base', op: 'STACKING_MULTIPLY', value: 0.4 };

  it.each([
    ['a scaled value', { value: { value: 0.4, times: ['stack', 'statusType'] } }],
    ['a scope', { scope: ['direct'] }],
    ['a filter', { filter: { bodyPart: 'weakPoint', damageTypes: ['heat'] } }],
    ['a faction bucket', { bucket: 'damage.faction.kuva-grineer' }],
    ['a trap', { value: -0.15 }],
  ])('accept %s', (_name, change) => {
    expect(accepts(effectSchema, { ...effect, ...change })).toBe(true);
  });

  it.each([
    ['an unknown variable', { value: { value: 0.4, times: ['kills'] } }],
    ['an empty scope', { scope: [] }],
    ['an explicit undefined', { scope: undefined }],
    ['a number that is not finite', { value: Number.POSITIVE_INFINITY }],
  ])('refuse %s', (_name, change) => {
    expect(accepts(effectSchema, { ...effect, ...change })).toBe(false);
  });
});

describe('conditions', () => {
  const stacks = { max: 2, perTrigger: 1, decay: 'one', duration: 20 };

  it.each([
    [{ trigger: 'onKill', target: 'self', stacks }, true],
    [{ trigger: 'onStatus:shield-drain', target: 'enemy' }, true],
    [{ trigger: 'onStatus', target: 'enemy' }, false],
    [{ trigger: 'onKill' }, false],
    [{ trigger: 'onKill', target: 'self', stacks: { ...stacks, max: 1.5 } }, false],
    [{ trigger: 'onWeakPointHit', requires: ['whileAiming'], target: 'self' }, true],
    [{ trigger: 'onWeakPointHit', requires: ['aiming'], target: 'self' }, false],
  ])('%j: %s', (condition, isValid) => {
    expect(accepts(conditionSchema, condition)).toBe(isValid);
  });
});

describe('extra hits and hooks', () => {
  it("describe Xata's Whisper", () => {
    const xata = {
      id: 'xatas-whisper',
      pct: 0.26,
      damageType: 'void',
      procRule: 'statusChance',
      critRule: 'never',
      factionRule: 'again',
    };
    expect(accepts(spawnInstanceSchema, xata)).toBe(true);
  });

  it.each([
    ['weapon.kohm.spool', true],
    ['perk.laetum.attrition', true],
    ['kohm', false],
    ['weapon.Kohm', false],
  ])('%s: %s', (ref, isValid) => {
    expect(accepts(hookRefSchema, ref)).toBe(isValid);
  });
});

describe('weapons', () => {
  const combo = { minHits: 5, reset: 2 };
  const form = { ...attack, id: 'incarnon-form' };
  const charge = { source: 'weakPointHit', perHit: 1, max: 10 };
  const battery = { magazine: 50, reloadStyle: 'battery', regenRate: 10, regenDelay: 1 };

  it.each([
    ['a battery', { ammo: battery }, true],
    ['a battery with a reload', { ammo: { ...battery, reloadTime: 2 } }, false],
    ['a progenitor bonus', { progenitor: { element: 'heat', pct: 0.6 } }, true],
    ['a progenitor bonus above 60%', { progenitor: { element: 'heat', pct: 0.61 } }, false],
    ['a sniper combo', { sniperCombo: combo }, true],
    ['a sniper combo of part of a hit', { sniperCombo: { ...combo, minHits: 1.5 } }, false],
    ['an Incarnon form', { incarnon: { form, charge, evolutions: [] } }, true],
    ['a form that reuses an id', { incarnon: { form: attack, charge, evolutions: [] } }, false],
    [
      'a link to the form',
      {
        incarnon: { form, charge, evolutions: [] },
        attacks: [{ ...attack, linkedAttacks: ['incarnon-form'] }],
      },
      true,
    ],
    ['no attacks', { attacks: [] }, false],
  ])('with %s', (_name, change, isValid) => {
    expect(accepts(weaponSchema, { ...weapon, ...change })).toBe(isValid);
  });
});

describe('modules', () => {
  it('may have no rank, no effects and only a hook', () => {
    const perk = {
      id: 'attrition',
      name: 'Attrition',
      uniqueName: '/Lotus/Perk',
      source: 'https://wiki.warframe.com/w/Laetum',
      gameVersion: '44.1.4.1',
      kind: 'buff',
      compat: { slots: ['secondary'] },
      effects: [],
      hooks: ['perk.laetum.attrition'],
    };
    expect(accepts(moduleSchema, perk)).toBe(true);
    expect(accepts(moduleSchema, { ...perk, uniqueName: 'Perk' })).toBe(false);
  });
});

describe('conditionals of one item', () => {
  const stacks = { max: 5, perTrigger: 1, decay: 'one', duration: 20 };
  const onTrigger = (trigger: string, change?: object) => ({
    bucket: 'damage.base',
    op: 'STACKING_MULTIPLY',
    value: 0.3,
    condition: { trigger, target: 'self', ...(change === undefined ? {} : { stacks: change }) },
  });

  it.each([
    [
      'stack alike on one trigger',
      [onTrigger('onKill', stacks), onTrigger('onKill', stacks)],
      true,
    ],
    ['both without stacks', [onTrigger('onKill'), onTrigger('onKill')], true],
    ['on two triggers', [onTrigger('onKill', stacks), onTrigger('onCrit')], true],
    [
      'with another max',
      [onTrigger('onKill', stacks), onTrigger('onKill', { ...stacks, max: 3 })],
      false,
    ],
    ['one without stacks', [onTrigger('onKill', stacks), onTrigger('onKill')], false],
  ])('%s: %s', (_name, effects, isValid) => {
    expect(accepts(moduleSchema, { ...module, effects })).toBe(isValid);
    expect(accepts(weaponSchema, { ...weapon, innatePassives: effects })).toBe(isValid);
  });
});

describe('falloff', () => {
  it.each([
    ['from 10 to 20 m', { start: 10, end: 20, minPct: 0.5 }, true],
    ['from the muzzle, to nothing', { start: 0, end: 20, minPct: 0 }, true],
    ['that ends where it starts', { start: 10, end: 10, minPct: 0.5 }, false],
    ['that ends closer than it starts', { start: 20, end: 10, minPct: 0.5 }, false],
    ['that adds damage', { start: 10, end: 20, minPct: 1.5 }, false],
  ])('%s', (_name, falloff, isValid) => {
    expect(accepts(weaponSchema, { ...weapon, attacks: [{ ...attack, falloff }] })).toBe(isValid);
  });
});

describe('scenarios', () => {
  const withProgenitor = (progenitor: object) => ({ build: { ...scenario.build, progenitor } });

  it.each([
    ['as they are', {}, true],
    ['with fractions that add up in floating point', { aim: { head: 0.7 + 0.2, body: 0.1 } }, true],
    ['that aim at 110%', { aim: { head: 0.6, body: 0.5 } }, false],
    ['that land beside the target', { aim: { head: 0, body: 1, missBy: 2.5 } }, true],
    ['that miss by less than nothing', { aim: { head: 0, body: 1, missBy: -1 } }, false],
    ['with a seed', { mode: 'montecarlo', seed: 7, runs: 100 }, true],
    ['with another progenitor', withProgenitor({ element: 'toxin', pct: 0.4 }), true],
    ['with a progenitor above 60%', withProgenitor({ element: 'toxin', pct: 0.7 }), false],
    ['in another mode', { mode: 'average' }, false],
    ['above the level cap', { enemy: { ...scenario.enemy, level: 10_000 } }, false],
  ])('%s', (_name, change, isValid) => {
    expect(accepts(scenarioSchema, { ...scenario, ...change })).toBe(isValid);
  });

  const onKill = { sourceId: 'galvanized-chamber', trigger: 'onKill' };

  it.each([
    ['on', true],
    ['off', true],
    [{ stacks: 3 }, true],
    ['max', false],
    [{ stacks: -1 }, false],
    [{ stacks: 1.5 }, false],
  ])('conditional state %j: %s', (state, isValid) => {
    const conditionals = { all: 'off', overrides: [{ ...onKill, state }] };
    const build = { ...scenario.build, conditionals };
    expect(accepts(scenarioSchema, { ...scenario, build })).toBe(isValid);
  });

  it.each([
    ['a global switch that is neither', { all: 'some', overrides: [] }, false],
    ['no global switch', { overrides: [] }, false],
    [
      'two overrides of one conditional',
      {
        all: 'on',
        overrides: [
          { ...onKill, state: 'on' },
          { ...onKill, state: 'off' },
        ],
      },
      false,
    ],
    [
      'overrides of two triggers',
      {
        all: 'on',
        overrides: [onKill, { ...onKill, trigger: 'onCrit' }].map((entry) => ({
          ...entry,
          state: 'on',
        })),
      },
      true,
    ],
  ])('with %s', (_name, conditionals, isValid) => {
    const build = { ...scenario.build, conditionals };
    expect(accepts(scenarioSchema, { ...scenario, build })).toBe(isValid);
  });
});

describe('golden fixtures', () => {
  const fixture = {
    id: 'T-1',
    question: 'Does it?',
    bible: '§6',
    gameVersion: '44.1.4.1',
    reports: [{ on: '2026-11-24', words: 'it does' }],
    tolerance: { hits: 0.5 },
    cases: [{ name: 'on the body', scenario, observed: { hits: { white: 29 } } }],
  };

  const withObserved = (observed: object) => ({ cases: [{ ...fixture.cases[0], observed }] });
  const wornDown = (hits: object) => ({ depleted: [{ layer: 'health', hits, last: 'white' }] });

  it.each([
    ['as they are', {}, true],
    ['with a Riven', { modules: [module] }, true],
    ['of every kind', withObserved({ arsenal: { fireRate: 5 }, neverProcs: ['slash'] }), true],
    ['timed by the magazine', withObserved({ firing: [{ shots: 'magazine', seconds: 15 }] }), true],
    ['timed by nothing', withObserved({ firing: [{ shots: 0, seconds: 15 }] }), false],
    ['in an unknown colour', withObserved({ hits: { blue: 29 } }), false],
    ['worn down', withObserved(wornDown({ white: 5 })), true],
    ['worn down by a last hit that is not counted', withObserved(wornDown({ yellow: 5 })), false],
    ['worn down by half a hit', withObserved(wornDown({ white: 4.5 })), false],
    ['worn down by nothing', withObserved({ depleted: [] }), false],
    ['that observe nothing', withObserved({}), false],
    ['without cases', { cases: [] }, false],
    ['without a report', { reports: [] }, false],
    ['reported on no day', { reports: [{ on: 'yesterday', words: 'it does' }] }, false],
    ['with another id', { id: 'test-1' }, false],
    ['of no section', { bible: 'section 6' }, false],
    ['with an explosion’s hits', withObserved({ hits: { white: 350 }, hitsOf: 'blast' }), true],
    ['with no hits of an explosion', withObserved({ hitsOf: 'blast' }), false],
  ])('%s', (_name, change, isValid) => {
    expect(accepts(goldenFixtureSchema, { ...fixture, ...change })).toBe(isValid);
  });
});
