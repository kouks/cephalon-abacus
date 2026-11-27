import { describe, expect, it } from 'vitest';

import { totalOf } from '@/build/aggregate';
import { DEFAULT_ASSUMPTIONS } from '@/assumptions';

import type { Taken } from './taken';
import { totalsWithTaken } from './taken';

const source = { id: 'test-status', name: 'Test status' };
const DIRECT = { scope: 'direct', assumptions: DEFAULT_ASSUMPTIONS } as const;

describe('a hit’s totals, with what the enemy takes', () => {
  const mod = { source: { id: 'mod', name: 'Mod' }, bucket: 'ammoEfficiency', op: 'ADD' } as const;
  const totals = new Map([
    ['ammoEfficiency', totalOf('ammoEfficiency', [{ ...mod, value: 0.5 }], { max: 0.75 })],
  ]);

  it('join the build’s own effects on a bucket, and keep its most', () => {
    const taken: readonly Taken[] = [{ source, bucket: 'ammoEfficiency', op: 'ADD', value: 0.5 }];
    const total = totalsWithTaken(totals, taken, DIRECT).get('ammoEfficiency');
    expect(total).toMatchObject({ add: 1, max: 0.75 });
    expect(total?.contributions.map(({ source: { id } }) => id)).toEqual(['mod', 'test-status']);
  });

  it('make a bucket the build has nothing on', () => {
    const taken: readonly Taken[] = [
      { source, bucket: 'enemy.health', op: 'STACKING_MULTIPLY', value: 1 },
    ];
    expect(totalsWithTaken(new Map(), taken, DIRECT).get('enemy.health')).toMatchObject({
      stacking: 1,
    });
  });

  it('leave out what doesn’t reach the hit', () => {
    const taken: readonly Taken[] = [
      { source, bucket: 'crit.chanceFlat', op: 'ADD', value: 0.25, scope: ['direct'] },
    ];
    const aoe = { ...DIRECT, scope: 'aoe' } as const;
    expect(totalsWithTaken(new Map(), taken, aoe).has('crit.chanceFlat')).toBe(false);
    expect(totalsWithTaken(new Map(), taken, DIRECT).has('crit.chanceFlat')).toBe(true);
  });
});
