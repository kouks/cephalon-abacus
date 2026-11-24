import { describe, expect, it } from 'vitest';

import {
  add,
  AMALGAM_SERRATION,
  GALVANIZED_APTITUDE,
  GALVANIZED_CHAMBER,
  GALVANIZED_SCOPE,
  HEAVY_CALIBER,
  makeLibrary,
  makeScenario,
  mod,
  PRIMARY_ACUITY,
  SERRATION,
  SPLIT_CHAMBER,
  when,
} from '@/testing/build';

import { collectEffects } from './collectEffects';

type Build = { readonly modules: readonly object[]; readonly change?: object };

const collect = ({ modules, change = {} }: Build, weaponChange: object = {}) => {
  const ids = modules.map((module) => ('id' in module ? { moduleId: module.id } : {}));
  return collectEffects(makeScenario(ids, change), makeLibrary(modules, weaponChange));
};

const collectAt = (rank: number, module: object, id: string) =>
  collectEffects(makeScenario([{ moduleId: id, rank }]), makeLibrary([module]));

describe('rank scaling', () => {
  it.each([
    [0, 0.15],
    [4, 0.75],
    [10, 1.65],
  ])('gives Serration at rank %i +%d', (rank, value) => {
    const [effect] = collectAt(rank, SERRATION, 'serration').effects;
    expect(effect?.value).toBeCloseTo(value, 12);
  });

  it('puts a module without a chosen rank at its max', () => {
    expect(collect({ modules: [SERRATION] }).effects[0]?.value).toBe(1.65);
  });

  it('reads explicit shares', () => {
    const uneven = mod('uneven', [add('damage.base', 2)], {
      rank: { max: 2, perRank: [0.1, 0.4, 1] },
    });
    const values = [0, 1, 2].map((rank) => collectAt(rank, uneven, 'uneven').effects[0]?.value);
    expect(values).toEqual([0.2, 0.8, 2]);
  });

  it('leaves a module without ranks alone', () => {
    const buff = mod('buff', [add('damage.base', 0.5)], { rank: undefined });
    expect(collect({ modules: [buff] }).effects[0]?.value).toBe(0.5);
  });

  it('scales the value of an expression', () => {
    const scaled = mod('scaled', [add('damage.base', { value: 1.1, times: ['statusType'] })]);
    const [effect] = collectAt(0, scaled, 'scaled').effects;
    expect(effect?.value).toBeCloseTo(0.1, 12);
    expect(effect?.times).toEqual(['statusType']);
  });

  it('caps a rank above the max, with a warning', () => {
    const { effects, warnings } = collectAt(12, SERRATION, 'serration');
    expect(effects[0]?.value).toBe(1.65);
    expect(warnings).toEqual([{ code: 'rankAboveMax', moduleId: 'serration', rank: 12, max: 10 }]);
  });
});

describe('sources', () => {
  it('come in order: the weapon, the build, the mission', () => {
    const scenario = makeScenario([{ moduleId: 'serration' }]);
    const mission = { ...scenario.enemy, modifiers: [{ moduleId: 'heavy-caliber' }] };
    const library = makeLibrary([SERRATION, HEAVY_CALIBER], {
      innatePassives: [add('damage.base', 0.1)],
    });
    const { effects } = collectEffects({ ...scenario, enemy: mission }, library);
    expect(effects.map(({ source }) => source.id)).toEqual([
      'test-rifle',
      'serration',
      'heavy-caliber',
    ]);
  });

  it('that do not exist are left out, with a warning', () => {
    const library = makeLibrary([SERRATION]);
    const scenario = makeScenario([{ moduleId: 'serratoin' }, { moduleId: 'serration' }]);
    const { effects, warnings } = collectEffects(scenario, library);
    expect(effects).toHaveLength(1);
    expect(warnings).toEqual([{ code: 'unknownModule', moduleId: 'serratoin' }]);
  });

  it('need a weapon that exists', () => {
    const scenario = makeScenario([], { weaponId: 'no-rifle' });
    expect(() => collectEffects(scenario, makeLibrary([]))).toThrow('No weapon "no-rifle"');
  });
});

describe('exclusive groups', () => {
  it('keep the first module, whichever it is', () => {
    const first = collect({ modules: [SERRATION, AMALGAM_SERRATION] });
    expect(first.effects.map(({ value }) => value)).toEqual([1.65]);
    expect(first.warnings).toEqual([
      { code: 'exclusiveGroup', moduleId: 'amalgam-serration', keptId: 'serration' },
    ]);
    const second = collect({ modules: [AMALGAM_SERRATION, SERRATION] });
    expect(second.effects.map(({ value }) => value)).toEqual([1.55]);
  });

  it('let modules without a group be', () => {
    const { effects, warnings } = collect({ modules: [HEAVY_CALIBER, SPLIT_CHAMBER, SERRATION] });
    expect([effects.length, warnings.length]).toEqual([3, 0]);
  });

  it('count the same module once', () => {
    const library = makeLibrary([SERRATION]);
    const twice = makeScenario([{ moduleId: 'serration' }, { moduleId: 'serration' }]);
    const { effects, warnings } = collectEffects(twice, library);
    expect(effects).toHaveLength(1);
    expect(warnings).toEqual([{ code: 'duplicateModule', moduleId: 'serration' }]);
  });
});

describe('locks', () => {
  it('drop every other change to the bucket, wherever the lock is', () => {
    const modules = [GALVANIZED_CHAMBER, SERRATION, PRIMARY_ACUITY, SPLIT_CHAMBER];
    const { effects, warnings } = collect(
      { modules },
      { innatePassives: [add('multishot', 0.2), add('fireRate', 0.1)] },
    );
    expect(effects.map(({ source, bucket }) => `${source.id} ${bucket}`)).toEqual([
      'test-rifle fireRate',
      'serration damage.base',
      'primary-acuity crit.chanceWeakPoint',
    ]);
    const lock = { code: 'lockedBucket', bucket: 'multishot', lockedBy: 'primary-acuity' };
    expect(warnings).toEqual([
      { ...lock, sourceId: 'test-rifle' },
      { ...lock, sourceId: 'galvanized-chamber' },
      { ...lock, sourceId: 'split-chamber' },
    ]);
  });

  it('have no effect when their module is left out', () => {
    const rival = { ...PRIMARY_ACUITY, exclusiveGroup: 'serration' };
    const { effects } = collect({ modules: [SERRATION, rival, SPLIT_CHAMBER] });
    expect(effects.map(({ bucket }) => bucket)).toEqual(['damage.base', 'multishot']);
  });

  it('take a locked conditional off the list of switches', () => {
    const { conditionals } = collect({ modules: [GALVANIZED_CHAMBER, PRIMARY_ACUITY] });
    expect(conditionals).toEqual([]);
  });
});

describe('conditionals', () => {
  const switches = (conditionals: object) => {
    const modules = [GALVANIZED_CHAMBER, GALVANIZED_SCOPE];
    const { conditionals: found, warnings } = collect({ modules, change: { conditionals } });
    return {
      stacks: Object.fromEntries(found.map(({ key, stacks }) => [key, stacks])),
      found,
      warnings,
    };
  };
  const chamber = (state: unknown) => ({
    sourceId: 'galvanized-chamber',
    trigger: 'onKill',
    state,
  });

  it('are one per source and trigger, with what they can reach', () => {
    const { found } = switches({ all: 'off', overrides: [] });
    expect(found.map(({ key, maxStacks }) => [key, maxStacks])).toEqual([
      ['galvanized-chamber onKill', 5],
      ['galvanized-scope onHeadshot', 1],
      ['galvanized-scope onWeakPointKill', 5],
    ]);
  });

  it('all start full when the global switch is on', () => {
    expect(switches({ all: 'on', overrides: [] }).stacks).toEqual({
      'galvanized-chamber onKill': 5,
      'galvanized-scope onHeadshot': 1,
      'galvanized-scope onWeakPointKill': 5,
    });
  });

  it('all start empty when it is off', () => {
    const { stacks } = switches({ all: 'off', overrides: [] });
    expect(Object.values(stacks)).toEqual([0, 0, 0]);
  });

  it('can each differ from the global switch, in both directions', () => {
    expect(switches({ all: 'off', overrides: [chamber('on')] }).stacks).toEqual({
      'galvanized-chamber onKill': 5,
      'galvanized-scope onHeadshot': 0,
      'galvanized-scope onWeakPointKill': 0,
    });
    const headshot = { sourceId: 'galvanized-scope', trigger: 'onHeadshot', state: 'off' };
    expect(switches({ all: 'on', overrides: [headshot] }).stacks).toEqual({
      'galvanized-chamber onKill': 5,
      'galvanized-scope onHeadshot': 0,
      'galvanized-scope onWeakPointKill': 5,
    });
  });

  it('switch on their own when two modules share a trigger', () => {
    const modules = [GALVANIZED_CHAMBER, GALVANIZED_APTITUDE];
    const stacks = (overrides: readonly object[]) =>
      collect({ modules, change: { conditionals: { all: 'off', overrides } } }).conditionals.map(
        (conditional) => conditional.stacks,
      );
    expect(stacks([chamber('on')])).toEqual([5, 0]);
    expect(stacks([{ ...chamber('on'), sourceId: 'galvanized-aptitude' }])).toEqual([0, 2]);
  });

  it('can start at a number of stacks, up to their max', () => {
    const start = (stacks: number) => switches({ all: 'off', overrides: [chamber({ stacks })] });
    expect(start(2).stacks['galvanized-chamber onKill']).toBe(2);
    expect(start(2).warnings).toEqual([]);
    expect(start(9).stacks['galvanized-chamber onKill']).toBe(5);
    expect(start(9).warnings).toEqual([
      {
        code: 'stacksAboveMax',
        sourceId: 'galvanized-chamber',
        trigger: 'onKill',
        stacks: 9,
        max: 5,
      },
    ]);
  });

  it('warn about an override that switches nothing', () => {
    const override = { sourceId: 'galvanized-chamber', trigger: 'onCrit', state: 'on' };
    expect(switches({ all: 'off', overrides: [override] }).warnings).toEqual([
      { code: 'unusedOverride', sourceId: 'galvanized-chamber', trigger: 'onCrit' },
    ]);
  });

  it('do not include effects that always apply', () => {
    const always = mod('always', [add('damage.base', 1, when('always'))]);
    expect(collect({ modules: [always, SERRATION] }).conditionals).toEqual([]);
  });

  it('include the weapon itself', () => {
    const passive = { innatePassives: [add('damage.base', 1, when('whileAiming'))] };
    const { conditionals } = collect({ modules: [] }, passive);
    expect(conditionals.map(({ key }) => key)).toEqual(['test-rifle whileAiming']);
  });
});
