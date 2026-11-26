import { describe, expect, it } from 'vitest';

import type { EnemyStats } from '@/enemy/scaleEnemy';

import { armorShare, defenceOf, firstLayer, hasLayer } from './defence';

describe('armor', () => {
  it.each([
    [0, 1],
    [300, 0.7],
    [2700, 0.1],
    [5000, 300 / 5300],
  ])('of %d leaves %d of the damage', (armor, share) => {
    expect(armorShare(armor)).toBeCloseTo(share, 12);
  });

  it('meets its square root at 2,700, and runs on above it', () => {
    expect(armorShare(2700)).toBeCloseTo(armorShare(2700.000001), 6);
    expect(armorShare(27_000)).toBeLessThan(armorShare(2700));
  });

  it('below none takes nothing off', () => {
    expect(armorShare(-50)).toBe(1);
  });
});

const stat = (value: number) => ({ value, terms: [] });

const statsOf = (overguard: number, shield: number, armor = 0): EnemyStats => ({
  level: 1,
  health: stat(100),
  shield: stat(shield),
  armor: stat(armor),
  overguard: stat(overguard),
});

describe('the first layer a hit meets', () => {
  it.each([
    ['overguard', statsOf(12, 50)],
    ['shield', statsOf(0, 50)],
    ['health', statsOf(0, 0)],
    ['health', undefined],
  ] as const)('is %s', (layer, stats) => {
    expect(firstLayer(stats)).toBe(layer);
  });
});

it('a layer is there if the enemy has some of it, and health always', () => {
  const stats = statsOf(0, 50);
  expect(['overguard', 'shield', 'health'].map((layer) => hasLayer(layer as never, stats))).toEqual(
    [false, true, true],
  );
  expect(hasLayer('shield', undefined)).toBe(false);
  expect(hasLayer('health', undefined)).toBe(true);
});

describe('a defence', () => {
  const rules = new Map();

  it('meets the layer the scenario names, or the first the enemy has', () => {
    expect(defenceOf({ stats: statsOf(0, 50, 300), rules })).toEqual({
      layer: 'shield',
      armor: 300,
      rules,
    });
    expect(defenceOf({ layer: 'health', stats: statsOf(0, 50, 300), rules }).layer).toBe('health');
  });

  it('of the neutral dummy is health without armor', () => {
    expect(defenceOf({ stats: undefined, rules })).toEqual({ layer: 'health', armor: 0, rules });
  });
});
