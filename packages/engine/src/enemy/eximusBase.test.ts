import { describe, expect, it } from 'vitest';

import { enemySchema } from '@abacus/data/schema/enemy';
import { scalingRuleSchema } from '@abacus/data/schema/scaling';
import { enemy } from '@abacus/data/testing/fixtures';
import { eximus } from '@abacus/data/testing/scaling';

import { eximusBase } from './eximusBase';

const rule = scalingRuleSchema.parse(eximus);

const baseAt = (level: number, change: object = {}) => {
  if (rule.kind !== 'eximus') throw new Error('Not an Eximus rule');
  return eximusBase(enemySchema.parse({ ...enemy, ...change }), level, rule);
};

const healthAt = (level: number, change: object = {}) => baseAt(level, change).health;

describe('an Eximus unit', () => {
  it('starts from more health the higher its level', () => {
    const levels = [1, 14, 15, 20, 25, 200].map((level) => healthAt(level, { baseHealth: 300 }));
    expect(levels).toEqual([450, 450, 450, 675, 900, 900]);
  });

  it('starts from less with shields or armor', () => {
    const levels = (change: object) =>
      [15, 20, 25].map((level) => healthAt(level, { baseHealth: 300, ...change }));
    expect(levels({ baseShield: 1 })).toEqual([330, 450, 600]);
    expect(levels({ baseArmor: 1 })).toEqual([330, 450, 600]);
  });

  it('starts from 1.1 times its health at least', () => {
    expect(healthAt(1, { baseHealth: 10_000 })).toBeCloseTo(11_000, 9);
  });

  it('starts from more shields too, 1.1 times them at least', () => {
    const shields = [1, 16, 20, 25].map((level) => baseAt(level, { baseShield: 100 }).shield);
    expect(shields.map((shield) => Number(shield.toFixed(9)))).toEqual([110, 110, 150, 200]);
    expect(baseAt(25).shield).toBe(0);
  });
});
