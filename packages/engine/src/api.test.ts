import { describe, expect, it } from 'vitest';

import type { Scenario } from '@abacus/data/schema/scenario';
import { enemy } from '@abacus/data/testing/fixtures';

import {
  add,
  GALVANIZED_CHAMBER,
  makeLibrary,
  makeScenario,
  mod,
  SERRATION,
} from '@/testing/build';
import { attackOf } from '@/testing/metrics';

import { API_VERSION, evaluate } from './api';

const modules = [SERRATION, GALVANIZED_CHAMBER];
const library = makeLibrary(modules);

const scenarioOf = (change: Partial<Scenario> = {}): Scenario => ({
  ...makeScenario(modules.map(({ id }) => ({ moduleId: id }))),
  aim: { head: 0.5, body: 0.5 },
  enemy: { id: 'neutral-dummy', level: 1, steelPath: false, modifiers: [] },
  ...change,
});

const freeze = <Value>(value: Value): Value => {
  if (typeof value === 'object' && value !== null) Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

/** What in a value is not plain data. */
const notPlain = (value: unknown, path = 'result'): readonly string[] => {
  if (value instanceof Map) {
    return [...value].flatMap(([key, entry]) => notPlain(entry, `${path}.${String(key)}`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) => notPlain(entry, `${path}.${key}`));
  }
  return ['number', 'string', 'boolean', 'undefined'].includes(typeof value) ? [] : [path];
};

describe('evaluate', () => {
  it('has the enemy’s stats, when it has some', () => {
    const charger = { id: 'charger', level: 200, steelPath: true, modifiers: [] };
    expect(() => evaluate(scenarioOf({ enemy: charger }), library)).toThrow('No enemy "charger"');
    expect(evaluate(scenarioOf(), library)).not.toHaveProperty('enemy');
    const withEnemy = makeLibrary(modules, {}, [enemy]);
    const met = { ...charger, id: 'test-enemy', level: 101 };
    const { enemy: stats } = evaluate(scenarioOf({ enemy: met }), withEnemy);
    expect(stats?.level).toBe(101);
    expect(stats?.health.value).toBeCloseTo(2.5 * 100 * 101, 1);
    expect(notPlain(stats)).toEqual([]);
  });

  it('has these fields, in this version', () => {
    const result = evaluate(scenarioOf(), library);
    expect(result.apiVersion).toBe(1);
    expect(API_VERSION).toBe(1);
    expect(Object.keys(result).sort()).toEqual([
      'apiVersion',
      'attackId',
      'burstDps',
      'byAttack',
      'lifetimeDamage',
      'perShot',
      'sustainedDps',
      'trace',
      'warnings',
    ]);
    expect(Object.keys(result.byAttack[0] ?? {}).sort()).toEqual([
      'attackId',
      'burstDps',
      'composition',
      'lifetimeDamage',
      'name',
      'perShot',
      'rates',
      'shots',
      'stats',
      'sustainedDps',
    ]);
    expect(Object.keys(result.trace[0] ?? {}).sort()).toEqual([
      'factors',
      'layer',
      'pellet',
      'perType',
      'procs',
      't',
    ]);
  });

  it('gives plain data', () => {
    expect(notPlain(evaluate(scenarioOf(), library))).toEqual([]);
  });

  it('gives the same result for the same scenario', () => {
    expect(evaluate(scenarioOf(), library)).toEqual(evaluate(scenarioOf(), library));
  });

  it('leaves the scenario as it is', () => {
    expect(() => evaluate(freeze(scenarioOf()), library)).not.toThrow();
  });

  it('takes other assumptions', () => {
    const vitalSense = mod('vital-sense', [add('crit.damage', 1.2)]);
    const attacks = [attackOf('normal', { critChance: 1, flags: ['canCrit', 'canHeadshot'] })];
    const critical = makeLibrary([vitalSense], { attacks });
    const build = { ...scenarioOf().build, modules: [{ moduleId: 'vital-sense' }] };
    const onHead = scenarioOf({ build, aim: { head: 1, body: 0 } });

    const assumptions = { headcritScalesModded: false };
    const changed = evaluate(onHead, critical, { assumptions }).perShot;
    expect(changed / evaluate(onHead, critical).perShot).toBeCloseTo(3.2 / 4.4, 9);
  });

  it('throws if there is nothing to evaluate', () => {
    const build = { ...scenarioOf().build, weaponId: 'nothing' };
    expect(() => evaluate(scenarioOf({ build }), library)).toThrow('No weapon "nothing"');
    const enemy = { ...scenarioOf().enemy, id: 'nobody' };
    expect(() => evaluate(scenarioOf({ enemy }), library)).toThrow('No enemy "nobody"');
  });
});
