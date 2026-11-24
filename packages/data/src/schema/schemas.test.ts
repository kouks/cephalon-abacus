import { describe, expect, expectTypeOf, it } from 'vitest';

import { attack, scenario, weapon } from '@/testing/fixtures';

import type { Attack } from './attack';
import { conditionSchema } from './condition';
import type { DamageMap, DamageType } from './damageType';
import { DAMAGE_TYPES } from './damageType';
import { effectSchema, spawnInstanceSchema } from './effect';
import { hitTraceSchema } from './hitTrace';
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
  const combo = { gainPerHit: 1, thresholds: [3, 9], multipliers: [1.5, 2], duration: 2 };
  const form = { ...attack, id: 'incarnon-form' };
  const charge = { source: 'weakPointHit', perHit: 1, max: 10 };
  const battery = { magazine: 50, reloadStyle: 'battery', regenRate: 10, regenDelay: 1 };

  it.each([
    ['a battery', { ammo: battery }, true],
    ['a battery with a reload', { ammo: { ...battery, reloadTime: 2 } }, false],
    ['a progenitor bonus', { progenitor: { element: 'heat', pct: 0.6 } }, true],
    ['a progenitor bonus above 60%', { progenitor: { element: 'heat', pct: 0.61 } }, false],
    ['a sniper combo', { sniperCombo: combo }, true],
    ['an uneven sniper combo', { sniperCombo: { ...combo, multipliers: [1.5] } }, false],
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

describe('scenarios', () => {
  const [instance] = scenario.build.modules;

  it.each([
    ['as they are', {}, true],
    ['with fractions that add up in floating point', { aim: { head: 0.7 + 0.2, body: 0.1 } }, true],
    ['that aim at 110%', { aim: { head: 0.6, body: 0.5 } }, false],
    ['with a seed', { mode: 'montecarlo', seed: 7, runs: 100 }, true],
    ['in another mode', { mode: 'average' }, false],
    ['above the level cap', { enemy: { ...scenario.enemy, level: 10_000 } }, false],
  ])('%s', (_name, change, isValid) => {
    expect(accepts(scenarioSchema, { ...scenario, ...change })).toBe(isValid);
  });

  it.each([
    ['off', true],
    ['assumeMax', true],
    ['simulate', true],
    [{ stacks: 3 }, true],
    ['max', false],
  ])('condition mode %j: %s', (conditionMode, isValid) => {
    const build = { ...scenario.build, modules: [{ ...instance, conditionMode }] };
    expect(accepts(scenarioSchema, { ...scenario, build })).toBe(isValid);
  });
});

describe('hit traces', () => {
  const trace = {
    t: 0.5,
    pellet: 0,
    factors: { crit: 2.4, faction: 1.3 },
    perType: { heat: 120.5 },
    layer: 'health',
    procs: [{ type: 'heat', count: 0.35 }],
  };

  it.each([
    ['a hit', {}, true],
    ['an unknown layer', { layer: 'armor' }, false],
    ['a factor that is not a number', { factors: { crit: '2x' } }, false],
    ['negative damage', { perType: { heat: -1 } }, false],
  ])('%s', (_name, change, isValid) => {
    expect(accepts(hitTraceSchema, { ...trace, ...change })).toBe(isValid);
  });
});
