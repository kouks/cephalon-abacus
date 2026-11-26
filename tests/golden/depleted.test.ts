import { describe, expect, it } from 'vitest';

import type { Depleted } from '@abacus/data/schema/goldenFixture';

import { describeMismatch, isMatch } from './comparison';
import { compareDepleted } from './depleted';
import { runOn, WHITE, YELLOW } from './made';

const matches = (depleted: readonly Depleted[], layers: Parameters<typeof runOn>[0]) =>
  compareDepleted({ depleted }, runOn(layers)).map(isMatch);

/** Four whites and two yellows: all of them, and all but the last. */
const health: Depleted = { layer: 'health', hits: { white: 4, yellow: 2 }, last: 'yellow' };
const ALL = 4 * WHITE + 2 * YELLOW;

it.each([
  [ALL - YELLOW, false],
  [ALL - YELLOW + 0.01, true],
  [ALL, true],
  [ALL + 0.01, false],
])('the last hit finishes a health of %d: %s', (value, expected) => {
  expect(matches([health], { health: value })).toEqual([expected]);
});

it('takes the colour of the last hit for what it dealt', () => {
  const last = { ...health, last: 'white' } as const;
  expect(matches([last], { health: ALL - WHITE })).toEqual([false]);
  expect(matches([last], { health: ALL - WHITE + 0.01 })).toEqual([true]);
});

describe('layers in turn', () => {
  /** Two whites break 150 of Overguard or shields, and leave 56.25 of the second. */
  const first = (layer: 'overguard' | 'shield'): Depleted => ({
    layer,
    hits: { white: 2 },
    last: 'white',
  });
  const three: Depleted = { layer: 'health', hits: { white: 3 }, last: 'white' };

  it('the rest of the hit that breaks Overguard goes on to health', () => {
    const run = (health: number) =>
      matches([first('overguard'), three], { overguard: 150, health });
    expect(run(56.25 + 2 * WHITE + 0.01)).toEqual([true, true]);
    expect(run(56.25 + 2 * WHITE - 0.01)).toEqual([true, false]);
  });

  it('5% of the rest of the hit that breaks shields goes on to health', () => {
    const run = (health: number) => matches([first('shield'), three], { shield: 150, health });
    expect(run(56.25 * 0.05 + 2 * WHITE + 0.01)).toEqual([true, true]);
    expect(run(56.25 + 2 * WHITE - 0.01)).toEqual([true, true]);
    expect(run(56.25 * 0.05 + 2 * WHITE - 0.01)).toEqual([true, false]);
  });
});

it('Toxin wears health down under shields: the last hit counts as it lands on health', () => {
  // All of the rifle's damage is Toxin, which isn't quantized: 100 a hit.
  const toxin = { damage: { toxin: 100 }, shield: 1000 };
  const two: Depleted = { layer: 'health', hits: { white: 2 }, last: 'white' };
  expect(matches([two], { ...toxin, health: 200 })).toEqual([true]);
  expect(matches([two], { ...toxin, health: 100 })).toEqual([false]);
});

it('a mismatch shows the bracket, the terms and what was left', () => {
  // A health of 5 is gone with the first hit, so the hits before the last took all of it.
  const [line] = compareDepleted({ depleted: [health] }, runOn({ health: 5 })).map(
    describeMismatch,
  );
  expect(line?.split('\n')).toEqual([
    `health: reported more than 5 and at most ${Number((5 + YELLOW).toPrecision(8))}, computed 5`,
    'health base 5',
    'health levels 0',
    'health low 1',
    'health high 1',
    'health blend 0',
    'health growth 1',
    'health left before the last hit 0',
  ]);
});

it('the neutral dummy has no layers', () => {
  expect(matches([health], 'dummy')).toEqual([false]);
});

it('a colour that never shows is an error', () => {
  const red: Depleted = { layer: 'health', hits: { red: 1 }, last: 'red' };
  expect(() => matches([red], { health: 1 })).toThrow('No red hit can happen');
});

it('nothing seen is nothing to compare', () => {
  expect(compareDepleted({}, runOn({ health: 1 }))).toEqual([]);
});
