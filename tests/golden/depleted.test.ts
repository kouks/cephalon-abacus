import { expect, it } from 'vitest';

import type { Depleted } from '@abacus/data/schema/goldenFixture';
import type { EnemyStat, EnemyStats } from '@abacus/engine';

import { describeMismatch, isMatch } from './comparison';
import { compareDepleted } from './depleted';

/** A hit of 100, and of 200 when it crits. */
const hit = {
  tiers: [
    { tier: 0, chance: 0.8, total: 100 },
    { tier: 1, chance: 0.2, total: 200 },
  ],
};

const stat = (value: number): EnemyStat => ({ value, terms: [{ name: 'base', value }] });

const enemyOf = (layers: { overguard?: number; shield?: number; health: number }): EnemyStats => ({
  level: 1,
  health: stat(layers.health),
  shield: stat(layers.shield ?? 0),
  armor: stat(0),
  overguard: stat(layers.overguard ?? 0),
});

/** Four whites and two yellows: 800, and 600 without the last. */
const health: Depleted = { layer: 'health', hits: { white: 4, yellow: 2 }, last: 'yellow' };

const matches = (depleted: readonly Depleted[], enemy: EnemyStats | undefined) =>
  compareDepleted({ depleted }, () => hit, enemy).map(isMatch);

it.each([
  [600, false],
  [600.01, true],
  [800, true],
  [800.01, false],
])('the last hit finishes a health of %d: %s', (value, expected) => {
  expect(matches([health], enemyOf({ health: value }))).toEqual([expected]);
});

it('takes the colour of the last hit for what it dealt', () => {
  const last = { ...health, last: 'white' } as const;
  expect(matches([last], enemyOf({ health: 700 }))).toEqual([false]);
  expect(matches([last], enemyOf({ health: 701 }))).toEqual([true]);
});

/** Two whites until the Overguard is gone, then the six hits. */
const layers: readonly Depleted[] = [
  { layer: 'overguard', hits: { white: 2 }, last: 'white' },
  health,
];

it('the rest of the hit that breaks Overguard goes on to health', () => {
  expect(matches(layers, enemyOf({ overguard: 120, health: 870 }))).toEqual([true, true]);
  expect(matches(layers, enemyOf({ overguard: 200, health: 600 }))).toEqual([true, false]);
  expect(matches(layers, enemyOf({ overguard: 100, health: 701 }))).toEqual([false, true]);
});

it('a mismatch shows the bracket and the terms', () => {
  const [, second] = compareDepleted({ depleted: layers }, () => hit, enemyOf({ health: 5 }));
  expect(second && describeMismatch(second)).toBe(
    [
      'overguard and health: reported more than 800 and at most 1000, computed 5',
      'overguard base 0',
      'health base 5',
    ].join('\n'),
  );
});

it('the neutral dummy has no layers', () => {
  expect(matches([health], undefined)).toEqual([false]);
});

it('a colour that never shows is an error', () => {
  const red: Depleted = { layer: 'health', hits: { red: 1 }, last: 'red' };
  expect(() => matches([red], enemyOf({ health: 1 }))).toThrow('No red hit can happen');
});

it('nothing seen is nothing to compare', () => {
  expect(compareDepleted({}, () => hit, enemyOf({ health: 1 }))).toEqual([]);
});
