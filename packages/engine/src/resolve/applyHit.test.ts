import { describe, expect, it } from 'vitest';

import type { DamageType } from '@abacus/data/schema/damageType';

import type { LayeredHit, LayersLeft } from './applyHit';
import { applyHit } from './applyHit';

/** The same damage on every layer: a type that no layer resists, and no armor. */
const even = (damage: Partial<Record<DamageType, number>>): LayeredHit => {
  const map = new Map(Object.entries(damage) as [DamageType, number][]);
  return { overguard: map, shield: map, health: map };
};

const left = (change: Partial<LayersLeft>): LayersLeft => ({
  overguard: 0,
  shield: 0,
  health: 1000,
  ...change,
});

const BODY = { isWeakPoint: false, isShownInOwnTerms: true };
const WEAK_POINT = { ...BODY, isWeakPoint: true };

const rounded = (applied: ReturnType<typeof applyHit>) =>
  applied.dealt.map(({ layer, shown, applied: lost }) => [layer, shown, Number(lost.toFixed(2))]);

describe('a hit that breaks shields', () => {
  /** T-38: a Crewman at level 100 has 8,006.7 shields; 8 whites and 3 yellows leave 323.2. */
  it('lets 5% of the rest through, and the shield shows everything else: 586 and 14', () => {
    const applied = applyHit(
      left({ shield: 323.2, health: 15_208 }),
      even({ radiation: 600 }),
      BODY,
    );
    expect(rounded(applied)).toEqual([
      ['shield', 586, 323.2],
      ['health', 14, 13.84],
    ]);
    expect(applied.left.shield).toBe(0);
    expect(applied.left.health).toBeCloseTo(15_208 - 13.84, 9);
  });

  it('on a weak point lets all of the rest through', () => {
    const applied = applyHit(left({ shield: 323.2 }), even({ radiation: 600 }), WEAK_POINT);
    expect(rounded(applied)).toEqual([
      ['shield', 323, 323.2],
      ['health', 277, 276.8],
    ]);
  });
});

it('a hit that breaks Overguard carries all of the rest on', () => {
  const applied = applyHit(left({ overguard: 100, shield: 50 }), even({ void: 300 }), BODY);
  expect(rounded(applied)).toEqual([
    ['overguard', 100, 100],
    ['shield', 192, 50],
    ['health', 8, 7.5],
  ]);
});

it('a layer that is gone is skipped', () => {
  const applied = applyHit(left({ overguard: 0, shield: 0 }), even({ impact: 300 }), BODY);
  expect(rounded(applied)).toEqual([['health', 300, 300]]);
});

it('a hit that doesn’t break a layer stays on it', () => {
  const applied = applyHit(left({ shield: 1000 }), even({ impact: 300 }), BODY);
  expect(rounded(applied)).toEqual([['shield', 300, 300]]);
  expect(applied.left).toEqual(left({ shield: 700 }));
});

it('Toxin goes past shields to health, and the rest stays on them', () => {
  const shield = new Map<DamageType, number>([['impact', 50]]);
  const health = new Map<DamageType, number>([
    ['impact', 50],
    ['toxin', 50],
  ]);
  const applied = applyHit(left({ shield: 1000 }), { overguard: health, shield, health }, BODY);
  expect(rounded(applied)).toEqual([
    ['shield', 50, 50],
    ['health', 50, 50],
  ]);
});

it('Toxin that breaks through Overguard shows on health, and not on Overguard as well', () => {
  const impact = new Map<DamageType, number>([['impact', 100]]);
  const both = new Map<DamageType, number>([...impact, ['toxin', 100]]);
  const hit = { overguard: both, shield: impact, health: both };
  const applied = applyHit(left({ overguard: 100, shield: 1000 }), hit, BODY);
  expect(rounded(applied)).toEqual([
    ['overguard', 100, 100],
    ['shield', 50, 50],
    ['health', 50, 50],
  ]);
});

it('the hit that kills shows all of it, and applies what health was left', () => {
  const applied = applyHit(left({ health: 100 }), even({ impact: 300 }), BODY);
  expect(rounded(applied)).toEqual([['health', 300, 100]]);
  expect(applied.left.health).toBe(0);
});

describe('a layer a hit breaks, where the next takes it differently (T-44)', () => {
  /** Armor halves the rest on health; the head bypasses the gate. */
  const armored = {
    ...even({ impact: 600 }),
    health: new Map<DamageType, number>([['impact', 300]]),
  };

  it('loses the same either way: armor counts on health, after the break', () => {
    const own = applyHit(left({ shield: 400 }), armored, WEAK_POINT);
    const later = applyHit(left({ shield: 400 }), armored, {
      ...WEAK_POINT,
      isShownInOwnTerms: false,
    });
    expect(own.left).toEqual(later.left);
    expect(own.dealt.map(({ applied }) => Number(applied.toFixed(9)))).toEqual([400, 100]);
  });

  it('shows what it had left, by default: the rest went on as it took it', () => {
    const applied = applyHit(left({ shield: 400 }), armored, WEAK_POINT);
    expect(rounded(applied)).toEqual([
      ['shield', 400, 400],
      ['health', 100, 100],
    ]);
  });

  it('shows the hit less what health shows of it, if not', () => {
    const applied = applyHit(left({ shield: 400 }), armored, {
      ...WEAK_POINT,
      isShownInOwnTerms: false,
    });
    expect(rounded(applied)).toEqual([
      ['shield', 500, 400],
      ['health', 100, 100],
    ]);
  });

  it('on Overguard, which takes 1.5x of Void, shows what it had left or the hit less what shields show', () => {
    const voidHit = {
      ...even({ void: 200 }),
      overguard: new Map<DamageType, number>([['void', 300]]),
    };
    const fresh = left({ overguard: 100, shield: 1000 });
    expect(rounded(applyHit(fresh, voidHit, BODY))).toEqual([
      ['overguard', 100, 100],
      ['shield', 133, 133.33],
    ]);
    const later = applyHit(fresh, voidHit, { ...BODY, isShownInOwnTerms: false });
    expect(rounded(later)[0]).toEqual(['overguard', 167, 100]);
  });

  it('counts Toxin that broke through Overguard and passed shields either way', () => {
    const impact = new Map<DamageType, number>([['impact', 100]]);
    const both = new Map<DamageType, number>([...impact, ['toxin', 100]]);
    const hit = { overguard: both, shield: impact, health: both };
    const fresh = left({ overguard: 100, shield: 1000 });
    const later = applyHit(fresh, hit, { ...BODY, isShownInOwnTerms: false });
    expect(rounded(later)).toEqual(rounded(applyHit(fresh, hit, BODY)));
  });
});
