import { describe, expect, it } from 'vitest';

import { scenario } from '@abacus/data/testing/fixtures';

import {
  DEFAULT_TEXT,
  parseText,
  scenarioIn,
  withModules,
  withTarget,
  withWeapon,
} from './scenarioText';

const TEXT = JSON.stringify({
  ...scenario,
  build: {
    ...scenario.build,
    weaponId: 'paris',
    attackId: 'charged',
    modules: [{ moduleId: 'serration', rank: 3 }, { moduleId: 'vital-sense' }],
  },
});

const buildIn = (text: string) => scenarioIn(text).build;

describe('a text', () => {
  it('can hold a scenario', () => {
    expect(buildIn(TEXT).weaponId).toBe('paris');
    expect(buildIn(DEFAULT_TEXT).weaponId).toBe('braton');
  });

  it.each(['', '{', '[]', '"paris"', '{"build":{}}'])('%j holds none: the default', (text) => {
    expect(scenarioIn(text)).toEqual(scenarioIn(DEFAULT_TEXT));
  });

  it('is JSON, or says why not', () => {
    expect(parseText('{"a":1}')).toEqual({ isJson: true, value: { a: 1 } });
    const broken = parseText('{');
    expect(broken.isJson ? '' : broken.problem).toMatch(/JSON/);
  });
});

describe('picking a weapon', () => {
  it('keeps the modules that fit it, and drops the firing mode of the last one', () => {
    expect(buildIn(withWeapon(TEXT, 'lex', ['vital-sense']))).toEqual({
      ...scenario.build,
      weaponId: 'lex',
      modules: [{ moduleId: 'vital-sense' }],
    });
  });

  it('keeps the rest of the scenario', () => {
    expect(scenarioIn(withWeapon(TEXT, 'lex', [])).aim).toEqual(scenario.aim);
  });

  it('starts over if there is no scenario', () => {
    expect(buildIn(withWeapon('{', 'lex', [])).weaponId).toBe('lex');
  });
});

describe('picking modules', () => {
  it('keeps the place and rank of those that were there', () => {
    const { modules, attackId } = buildIn(
      withModules(TEXT, ['hellfire', 'vital-sense', 'serration']),
    );
    expect(modules).toEqual([
      { moduleId: 'serration', rank: 3 },
      { moduleId: 'vital-sense' },
      { moduleId: 'hellfire' },
    ]);
    expect(attackId).toBe('charged');
  });

  it('takes out the others', () => {
    expect(buildIn(withModules(TEXT, [])).modules).toEqual([]);
  });
});

describe('picking a target', () => {
  const aimed = JSON.stringify({
    ...scenario,
    enemy: { ...scenario.enemy, level: 120, steelPath: true },
    aim: { head: 0.25, body: 0.75, weakPoint: 'maw', missBy: 2 },
  });

  it('keeps its level and the Steel Path, and the rest of the scenario', () => {
    const { enemy, build, distance } = scenarioIn(withTarget(aimed, 'lancer'));
    expect(enemy).toEqual({ ...scenario.enemy, id: 'lancer', level: 120, steelPath: true });
    expect(build).toEqual(scenarioIn(aimed).build);
    expect(distance).toBe(scenario.distance);
  });

  it('aims at its head instead of a part of the last one', () => {
    const { aim } = scenarioIn(withTarget(aimed, 'lancer'));
    expect(aim).toEqual({ head: 0.25, body: 0.75, missBy: 2 });
  });

  it('starts over if there is no scenario', () => {
    expect(scenarioIn(withTarget('{', 'lancer')).enemy.id).toBe('lancer');
  });
});
