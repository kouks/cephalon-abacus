import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';

import {
  add,
  DIRECT,
  GALVANIZED_APTITUDE,
  GALVANIZED_CHAMBER,
  HEAVY_CALIBER,
  makeLibrary,
  makeScenario,
  mod,
  PRIMARY_ACUITY,
  SERRATION,
  when,
} from '@/testing/build';

import { aggregate } from './aggregate';
import { collectEffects } from './collectEffects';
import type { Moment } from './contributions';
import { NO_VARIABLES } from './contributions';
import type { Selection } from './selectEffects';
import { attackTagsOf } from './selectEffects';
import { startOf, totalBuckets } from './totalBuckets';

const OFF = { all: 'off', overrides: [] };
const ON = { all: 'on', overrides: [] };

type Options = {
  readonly conditionals?: object;
  readonly selection?: Selection;
  readonly moment?: Moment;
};

const totals = (modules: readonly { id: string }[], options: Options = {}) => {
  const { conditionals = OFF, selection = DIRECT, moment } = options;
  const library = makeLibrary(modules);
  const ids = modules.map(({ id }) => ({ moduleId: id }));
  const collected = collectEffects(makeScenario(ids, { conditionals }), library);
  return totalBuckets(collected, library, {
    selection,
    ...(moment === undefined ? {} : { moment }),
  });
};

const value = (from: ReturnType<typeof totals>, name: string, base = 1) =>
  aggregate(must(from.get(name), `No total for ${name}`), base);

describe('totals', () => {
  it('cover every bucket, with or without effects', () => {
    const all = totals([SERRATION]);
    const plain = ['damage.base', 'multishot', 'crit.chance', 'fireRate', 'ammoEfficiency'];
    for (const name of plain) expect(all.has(name)).toBe(true);
    expect(all.has('damage.faction')).toBe(false);
    expect(value(all, 'multishot', 3)).toBe(3);
    expect(all.get('multishot')?.contributions).toEqual([]);
  });

  it('say what each module adds: Serration, +165% damage.base', () => {
    const base = must(totals([SERRATION, HEAVY_CALIBER]).get('damage.base'), 'no total');
    expect(base.contributions).toEqual([
      {
        source: { id: 'serration', name: 'serration' },
        bucket: 'damage.base',
        op: 'STACKING_MULTIPLY',
        value: 1.65,
      },
      {
        source: { id: 'heavy-caliber', name: 'heavy-caliber' },
        bucket: 'damage.base',
        op: 'STACKING_MULTIPLY',
        value: 1.65,
      },
    ]);
    expect(aggregate(base, 100)).toBeCloseTo(430, 10);
  });

  it('keep the members of a family apart', () => {
    const bane = mod('bane', [add('damage.faction.grineer', 0.3)]);
    const roar = mod('roar', [add('damage.faction.all', 0.5)]);
    const all = totals([bane, roar]);
    expect(value(all, 'damage.faction.grineer')).toBeCloseTo(1.3, 12);
    expect(value(all, 'damage.faction.all')).toBeCloseTo(1.5, 12);
    expect(all.has('damage.faction.corpus')).toBe(false);
  });

  it('stop at the max of the bucket', () => {
    const efficient = mod('efficient', [add('ammoEfficiency', 1.2, { op: 'ADD' })]);
    expect(value(totals([efficient]), 'ammoEfficiency', 0)).toBe(0.75);
  });
});

describe('Galvanized Chamber', () => {
  const multishot = (options: Options) => value(totals([GALVANIZED_CHAMBER], options), 'multishot');

  it('starts with all five stacks when it is on', () => {
    expect(multishot({ conditionals: ON })).toBeCloseTo(1 + 0.8 + 5 * 0.3, 12);
  });

  it('starts without stacks when it is off', () => {
    expect(multishot({ conditionals: OFF })).toBeCloseTo(1.8, 12);
  });

  it('gains stacks during a simulation when it is off', () => {
    const stacks = new Map([['galvanized-chamber onKill', 2]]);
    const moment = { stacks, variables: NO_VARIABLES };
    expect(multishot({ conditionals: OFF, moment })).toBeCloseTo(1 + 0.8 + 2 * 0.3, 12);
  });

  it('shows its stacks in the breakdown', () => {
    const total = totals([GALVANIZED_CHAMBER], { conditionals: ON }).get('multishot');
    expect(
      total?.contributions.map(({ value: added, conditional }) => [added, conditional]),
    ).toEqual([
      [0.8, undefined],
      [1.5, { trigger: 'onKill', stacks: 5, maxStacks: 5 }],
    ]);
  });

  it('leaves the stacks out of the breakdown when there are none', () => {
    const total = totals([GALVANIZED_CHAMBER], { conditionals: OFF }).get('multishot');
    expect(total?.contributions).toHaveLength(1);
  });
});

describe('an effect that requires something else', () => {
  const SCOPE = mod('scope', [
    add('crit.chance', 1.2, {
      condition: { trigger: 'onWeakPointHit', requires: ['whileAiming'], target: 'self' },
    }),
  ]);
  const chance = (...triggers: readonly string[]) => {
    const overrides = triggers.map((trigger) => ({ sourceId: 'scope', trigger, state: 'on' }));
    const conditionals = { all: 'off', overrides };
    return value(totals([SCOPE], { conditionals }), 'crit.chance');
  };

  it('counts only if both hold', () => {
    expect(chance('onWeakPointHit', 'whileAiming')).toBeCloseTo(2.2, 12);
    expect(chance('onWeakPointHit')).toBe(1);
    expect(chance('whileAiming')).toBe(1);
    expect(chance()).toBe(1);
  });

  it('counts when everything is on', () => {
    expect(value(totals([SCOPE], { conditionals: ON }), 'crit.chance')).toBeCloseTo(2.2, 12);
  });
});

describe('scaled values', () => {
  const moment = (statusType: number) => ({
    stacks: new Map([['galvanized-aptitude onKill', 2]]),
    variables: { ...NO_VARIABLES, statusType },
  });
  const damage = (statusType: number, selection = DIRECT) =>
    value(totals([GALVANIZED_APTITUDE], { moment: moment(statusType), selection }), 'damage.base');

  it('multiply by each variable: 40% x 2 stacks x 3 status types', () => {
    expect(damage(3)).toBeCloseTo(1 + 0.4 * 2 * 3, 12);
  });

  it('add nothing while a variable is zero', () => {
    expect(damage(0)).toBe(1);
  });

  it('count stacks once, named or not', () => {
    const named = mod('named', [
      add('multishot', { value: 0.1, times: ['stack'] }, when('onKill', 4)),
    ]);
    const plain = mod('plain', [add('multishot', 0.1, when('onKill', 4))]);
    const all = totals([named, plain], { conditionals: ON }).get('multishot');
    expect(all?.contributions.map(({ value: added }) => added)).toEqual([0.4, 0.4]);
  });

  it('follow ability strength and the combo', () => {
    const roar = mod('roar', [add('damage.base', { value: 0.5, times: ['abilityStrength'] })]);
    const rush = mod('rush', [add('crit.chance', { value: 0.4, times: ['comboTier'] })]);
    const variables = { statusType: 0, comboTier: 6, abilityStrength: 1.4 };
    const all = totals([roar, rush], { moment: { stacks: new Map(), variables } });
    expect(value(all, 'damage.base')).toBeCloseTo(1.7, 12);
    expect(value(all, 'crit.chance')).toBeCloseTo(3.4, 12);
  });

  it('start with nothing on the target and abilities at 100%', () => {
    const collected = collectEffects(makeScenario([]), makeLibrary([]));
    expect(startOf(collected).variables).toEqual({
      statusType: 0,
      comboTier: 0,
      abilityStrength: 1,
    });
  });

  it('keep an override to zero', () => {
    const none = mod('none', [add('crit.chance', 0, { op: 'OVERRIDE' })]);
    expect(value(totals([none]), 'crit.chance', 0.5)).toBe(0);
  });
});

describe('scopes', () => {
  const at = (scope: Selection['scope']): Selection => ({ ...DIRECT, scope });
  const scoped = (scope: Selection['scope'], name: string, effect: object = {}) =>
    value(totals([mod('scoped', [add(name, 1, effect)])], { selection: at(scope) }), name);

  it('follow the bucket: crit chance reaches AoE, weak point crit chance does not', () => {
    expect(scoped('aoe', 'crit.chance')).toBe(2);
    expect(scoped('aoe', 'crit.chanceWeakPoint')).toBe(1);
  });

  it('are narrowed by the effect: direct only', () => {
    expect(scoped('direct', 'damage.base', { scope: ['direct'] })).toBe(2);
    expect(scoped('proc', 'damage.base', { scope: ['direct'] })).toBe(1);
  });

  it('are not widened by the effect', () => {
    expect(scoped('aoe', 'crit.chanceWeakPoint', { scope: ['aoe'] })).toBe(1);
  });

  it('do not matter to buckets that are not about damage', () => {
    expect(scoped('proc', 'fireRate')).toBe(2);
  });
});

describe('filters', () => {
  const filtered = (filter: object, selection: Partial<Selection>) =>
    value(
      totals([mod('filtered', [add('damage.base', 1, { filter })])], {
        selection: { ...DIRECT, ...selection },
      }),
      'damage.base',
    );

  it.each([
    ['one of the tags', ['aoe', 'burst'], ['burst'], 2],
    ['none of the tags', ['aoe'], ['burst'], 1],
  ])('by attack tag: %s', (...[, wanted, tags, result]) => {
    expect(filtered({ attackTags: wanted }, { attackTags: new Set(tags) })).toBe(result);
  });

  it.each([
    ['heat', 2],
    ['cold', 1],
    [undefined, 1],
  ] as const)('by damage type: %s', (damageType, result) => {
    const selection = damageType === undefined ? {} : { damageType };
    expect(filtered({ damageTypes: ['heat'] }, selection)).toBe(result);
  });

  it('by body part: Acuity on a weak point, and elsewhere', () => {
    const on = (bodyParts: Selection['bodyParts']) => {
      const selection = bodyParts === undefined ? DIRECT : { ...DIRECT, bodyParts };
      return value(totals([PRIMARY_ACUITY], { selection }), 'crit.chanceWeakPoint');
    };
    expect(on(new Set(['weakPoint']))).toBe(4.5);
    expect(on(new Set(['head']))).toBe(1);
    expect(on(undefined)).toBe(1);
  });

  it('need all of their parts to match', () => {
    const filter = { damageTypes: ['heat'], bodyPart: 'head' };
    expect(filtered(filter, { damageType: 'heat', bodyParts: new Set(['head']) })).toBe(2);
    expect(filtered(filter, { damageType: 'heat' })).toBe(1);
  });

  it("read an attack's tags from its trigger, shot type, flags and weapon", () => {
    const library = makeLibrary([], { compatTags: ['BEAM'] });
    const weapon = must(library.weapons.get('test-rifle'), 'no weapon');
    const attack = { ...must(weapon.attacks[0], 'no attack'), flags: ['isAoE'] as const };
    expect([...attackTagsOf(weapon, attack)]).toEqual(['auto', 'hitscan', 'isAoE', 'BEAM']);
  });
});
