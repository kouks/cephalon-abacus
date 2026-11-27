import { describe, expect, it } from 'vitest';

import { scenario, status } from '@/testing/fixtures';

import { scenarioSchema } from './scenario';
import { statusSchema } from './status';

const accepts = (effects: readonly object[]) =>
  statusSchema.safeParse({ ...status, effects }).success;

describe('a status’s effects', () => {
  const effect = { bucket: 'enemy.health', op: 'STACKING_MULTIPLY', first: 1, more: 0.25 };

  it.each([
    ['as they are', {}, true],
    ['with a value at the most', { atMost: 1 }, true],
    ['for direct hits alone', { scope: ['direct'] }, true],
    ['for hits that are no scope', { scope: ['melee'] }, false],
    ['with another op', { op: 'DIVIDE' }, false],
    ['without a value for more stacks', { more: undefined }, false],
    ['with the old shape', { on: 'statusChanceTaken' }, false],
  ])('%s', (_name, change, isValid) => {
    const changed = Object.fromEntries(
      Object.entries({ ...effect, ...change }).filter(([, value]) => value !== undefined),
    );
    expect(accepts([changed])).toBe(isValid);
  });
});

describe('the statuses on a scenario’s enemy', () => {
  it.each([
    ['by id, with a share of a stack', { virus: 2.5 }, true],
    ['with no stacks', { virus: 0 }, false],
    ['by something that is no id', { Virus: 1 }, false],
  ])('%s', (_name, statuses, isValid) => {
    const enemy = { ...scenario.enemy, statuses };
    expect(scenarioSchema.safeParse({ ...scenario, enemy }).success).toBe(isValid);
  });
});

describe('a status that ticks', () => {
  const dot = { coefficient: 0.35, delay: 1, dealsAs: 'cinematic' };
  const accepted = (value: object) => statusSchema.safeParse(value).success;

  it.each([
    ['as Slash does', { dot }, true],
    ['raised by an element, with a reach', { dot: { ...dot, scaledBy: 'gas', reach: 3 } }, true],
    ['as no damage type', { dot: { ...dot, dealsAs: 'bleeding' } }, false],
    ['from before its proc', { dot: { ...dot, delay: -1 } }, false],
    ['until the enemy dies', { dot, duration: undefined }, false],
  ])('%s', (_name, change, isValid) => {
    const changed = Object.fromEntries(
      Object.entries({ ...status, ...change }).filter(([, value]) => value !== undefined),
    );
    expect(accepted(changed)).toBe(isValid);
  });
});
