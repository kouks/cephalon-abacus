import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { BODY, HEAD, hit, makeTarget, shot, WEAK_POINT } from '@/testing/hit';

const attack = { flags: ['canCrit', 'canHeadshot'] };
const SPLIT_CHAMBER = mod('split-chamber', [add('multishot', 0.9)]);
const onBody = { head: 0, body: 1 };

const body = hit({ attack }, BODY).total;
const head = hit({ attack }, HEAD).total;

describe('an average shot', () => {
  it('is one hit for one pellet', () => {
    const result = shot({ attack, aim: onBody });
    expect(result.pellets).toBe(1);
    expect(result.hits).toHaveLength(1);
    expect(result.total).toBeCloseTo(body, 9);
  });

  it('counts a fraction of a pellet as a share of its damage', () => {
    const result = shot({ attack, modules: [SPLIT_CHAMBER], aim: onBody });
    expect(result.pellets).toBe(1.9);
    expect(result.total).toBeCloseTo(1.9 * body, 9);
    const shotgun = shot({ attack: { ...attack, multishot: 8 }, aim: onBody });
    expect(shotgun.total).toBeCloseTo(8 * body, 9);
  });

  it('lands where it is aimed', () => {
    const result = shot({ attack, aim: { head: 0.6, body: 0.4 } });
    expect(result.hits.map(({ share }) => share)).toEqual([0.6, 0.4]);
    expect(result.total).toBeCloseTo(0.6 * head + 0.4 * body, 9);
    const perType = [...result.perType.values()].reduce((sum, value) => sum + value, 0);
    expect(perType).toBeCloseTo(result.total, 9);
  });

  it('can aim at another part instead of the head', () => {
    const acuity = mod('acuity', [add('weakPoint.damage', 3.5, { op: 'ADD' })]);
    const aim = { head: 1, body: 0, weakPoint: 'backpack' };
    const result = shot({ attack, modules: [acuity], aim });
    expect(result.total).toBeCloseTo(hit({ attack, modules: [acuity] }, WEAK_POINT).total, 9);
    expect(result.total).toBeCloseTo(4.5 * body, 9);
  });

  it('hits the body where the target has no such part', () => {
    const aim = { head: 1, body: 0, weakPoint: 'tail' };
    expect(shot({ attack, aim }).total).toBeCloseTo(body, 9);
    const blob = makeTarget({ parts: new Map([['body', { multiplier: 0.5, bodyParts: [] }]]) });
    expect(shot({ attack, aim: { head: 1, body: 0 }, target: blob }).total).toBeCloseTo(
      body / 2,
      9,
    );
    const nothing = makeTarget({ parts: new Map() });
    expect(shot({ attack, aim: onBody, target: nothing }).total).toBeCloseTo(body, 9);
  });

  it('hits the body if it can’t headshot', () => {
    const aim = { head: 1, body: 0 };
    const explosion = { flags: ['canCrit', 'isAoE'] };
    expect(shot({ attack: explosion, aim }).total).toBeCloseTo(body, 9);
  });

  it('fires nothing when multishot is gone', () => {
    const riven = mod('riven', [add('multishot', -1.5)]);
    expect(shot({ attack, modules: [riven], aim: onBody })).toMatchObject({ pellets: 0, total: 0 });
  });
});
