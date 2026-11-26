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

describe('a hit that breaks Overguard (T-44)', () => {
  it('carries all of the rest on, and shows one number for all it does', () => {
    const applied = applyHit(left({ overguard: 100, shield: 50 }), even({ void: 300 }), BODY);
    expect(rounded(applied)).toEqual([
      ['overguard', 300, 100],
      ['shield', undefined, 50],
      ['health', undefined, 7.5],
    ]);
  });

  /** T-44: 130 of Overguard, and armor that leaves 75.5% of the rest on health, show 485. */
  it('shows what Overguard had left and what health took after armor, rounded once', () => {
    const armored = {
      ...even({ radiation: 600 }),
      health: new Map<DamageType, number>([['radiation', 600 * 0.75505]]),
    };
    const applied = applyHit(left({ overguard: 130.098 }), armored, BODY);
    expect(rounded(applied)).toEqual([
      ['overguard', 485, 130.1],
      ['health', undefined, 354.8],
    ]);
  });

  it('shows its own number when it holds', () => {
    const applied = applyHit(left({ overguard: 1000 }), even({ impact: 300 }), BODY);
    expect(rounded(applied)).toEqual([['overguard', 300, 300]]);
  });
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

it('Toxin that breaks through Overguard and passes shields counts once in its number', () => {
  const impact = new Map<DamageType, number>([['impact', 100]]);
  const both = new Map<DamageType, number>([...impact, ['toxin', 100]]);
  const hit = { overguard: both, shield: impact, health: both };
  const applied = applyHit(left({ overguard: 100, shield: 1000 }), hit, BODY);
  expect(rounded(applied)).toEqual([
    ['overguard', 200, 100],
    ['shield', undefined, 50],
    ['health', undefined, 50],
  ]);
});

it('the hit that kills shows all of it, and applies what health was left', () => {
  const applied = applyHit(left({ health: 100 }), even({ impact: 300 }), BODY);
  expect(rounded(applied)).toEqual([['health', 300, 100]]);
  expect(applied.left.health).toBe(0);
});

describe('a shield a hit breaks, where health takes it differently (T-47)', () => {
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

  it('leaves Overguard’s one number alone: Void counts as Overguard took it, the rest as shields did', () => {
    const voidHit = {
      ...even({ void: 200 }),
      overguard: new Map<DamageType, number>([['void', 300]]),
    };
    const fresh = left({ overguard: 100, shield: 1000 });
    const expected = [
      ['overguard', 233, 100],
      ['shield', undefined, 133.33],
    ];
    expect(rounded(applyHit(fresh, voidHit, BODY))).toEqual(expected);
    const later = applyHit(fresh, voidHit, { ...BODY, isShownInOwnTerms: false });
    expect(rounded(later)).toEqual(expected);
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
