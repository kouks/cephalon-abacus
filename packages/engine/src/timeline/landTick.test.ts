import { describe, expect, it } from 'vitest';

import type { LayersLeft } from '@/resolve/applyHit';
import { makeLibrary } from '@/testing/build';
import { fightOn, procOf } from '@/testing/tick';

import type { EnemyState } from './enemyState';
import { stateOf } from './enemyState';
import { landTick } from './landTick';
import { addStack, NO_STATUSES } from './statuses';
import { statusRuleOf } from './statusRules';

const library = makeLibrary([]);

/** A bleed with a seed of 100: (100 + 1) × 0.35. A poison's is × 0.5. */
const BLEED = 101 * 0.35;
const POISON = 101 * 0.5;

/** The enemy with this left, at a time, with stacks of a status that last 6 s from 0 s. */
const enemyWith = (left: Partial<LayersLeft>, stacks: Readonly<Record<string, number>> = {}) => {
  const fight = fightOn(left);
  const statuses = Object.entries(stacks).reduce(
    (sofar, [status, amount]) =>
      addStack(sofar, { status, at: 0, amount, duration: 6 }, statusRuleOf(status, library)),
    NO_STATUSES,
  );
  return { fight, state: { ...stateOf(fight.defence.left), statuses } };
};

const at = (state: EnemyState, time: number) => ({ ...state, at: time });

const valueOf = (
  factors: readonly { readonly name: string; readonly value: number }[],
  name: string,
) => factors.find((entry) => entry.name === name)?.value;

describe('a tick on the enemy as it is when the tick lands (BIBLE §8)', () => {
  it('deals the proc’s tick on health, and wears it down', () => {
    const { fight, state } = enemyWith({});
    const { tick, state: after } = landTick(at(state, 2), procOf(), fight);
    expect(tick.damage).toBeCloseTo(BLEED, 5);
    expect([tick.t, tick.layer, tick.status, tick.seed]).toEqual([2, 'health', 'bleed', 100]);
    expect(after.left.health).toBeCloseTo(1000 - BLEED, 5);
  });

  it('meets the Viral on the enemy then: two stacks until they end at 6 s', () => {
    const { fight, state } = enemyWith({}, { virus: 2 });
    const amplified = landTick(at(state, 5), procOf(), fight).tick;
    expect(valueOf(amplified.factors, 'amplifier')).toBe(2.25);
    expect(amplified.damage).toBeCloseTo(BLEED * 2.25, 5);
    const after = landTick(at(state, 6), procOf(), fight).tick;
    expect(valueOf(after.factors, 'amplifier')).toBe(1);
  });

  it('meets Magnetic on shields, which a bleed wears down and a poison skips', () => {
    const { fight, state } = enemyWith({ shield: 200 }, { disrupt: 1, virus: 1 });
    const bleed = landTick(at(state, 1), procOf(), fight);
    expect([bleed.tick.layer, valueOf(bleed.tick.factors, 'amplifier')]).toEqual(['shield', 2]);
    expect(bleed.state.left.shield).toBeCloseTo(200 - 2 * BLEED, 5);
    expect(bleed.state.left.health).toBe(1000);
    const poison = landTick(at(state, 1), procOf({ status: 'poison' }), fight);
    expect([poison.tick.layer, valueOf(poison.tick.factors, 'amplifier')]).toEqual(['health', 2]);
    expect(poison.state.left.shield).toBe(200);
    expect(poison.state.left.health).toBeCloseTo(1000 - 2 * POISON, 5);
  });

  it('goes on at 5% past the shields it breaks, as a hit on no weak point does', () => {
    const { fight, state } = enemyWith({ shield: 10 });
    const { state: after } = landTick(at(state, 1), procOf(), fight);
    expect(after.left.shield).toBe(0);
    expect(after.left.health).toBeCloseTo(1000 - (BLEED - 10) * 0.05, 5);
  });

  it('is reduced by armor, unless its type bypasses it as a bleed’s Cinematic does', () => {
    const fight = fightOn({}, 300);
    const state = stateOf(fight.defence.left, 1);
    const poison = landTick(state, procOf({ status: 'poison' }), fight).tick;
    expect(valueOf(poison.factors, 'armor')).toBeCloseTo(0.7, 12);
    expect(poison.damage).toBeCloseTo(POISON * 0.7, 5);
    expect(landTick(state, procOf(), fight).tick.damage).toBeCloseTo(BLEED, 5);
  });

  it('wears the enemy down by its share of a proc, and traces a whole proc’s tick', () => {
    const { fight, state } = enemyWith({});
    const { tick, state: after } = landTick(at(state, 1), procOf({ share: 0.25 }), fight);
    expect([tick.share, tick.damage]).toEqual([0.25, expect.closeTo(BLEED, 5)]);
    expect(after.left.health).toBeCloseTo(1000 - 0.25 * BLEED, 5);
  });

  it('leaves the neutral dummy’s endless health endless', () => {
    const { fight, state } = enemyWith({ health: Number.POSITIVE_INFINITY });
    expect(landTick(at(state, 1), procOf(), fight).state.left.health).toBe(Infinity);
  });

  it('traces the factors of the tick formula, on the layer it met', () => {
    const { fight, state } = enemyWith({});
    const { tick } = landTick(at(state, 1), procOf(), fight);
    expect(tick.factors.map(({ name }) => name)).toEqual([
      'seed',
      'coefficient',
      'element',
      'faction',
      'statusDamage',
      'vulnerability',
      'layer',
      'armor',
      'amplifier',
      'reduction',
    ]);
    expect(tick.factors.reduce((product, { value }) => product * value, 1)).toBeCloseTo(BLEED, 5);
  });
});
