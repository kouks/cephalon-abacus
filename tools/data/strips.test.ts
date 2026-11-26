import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import { scenarioSchema } from '#data/schema/scenario.ts';
import { scenario } from '#data/testing/fixtures.ts';
import type { Assumptions } from '#engine/assumptions.ts';
import { evaluate } from '#engine/api.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();

type Met = { readonly withAura: boolean; readonly assumptions?: Partial<Assumptions> };

/** One Braton hit on a level's enemy, with Corrosive Projection at max or without it. */
const hitOn = (id: string, level: number, { withAura, assumptions = {} }: Met) => {
  const modules = withAura ? [{ moduleId: 'corrosive-projection' }] : [];
  const met = scenarioSchema.parse({
    ...scenario,
    build: { ...scenario.build, weaponId: 'braton', modules },
    enemy: { id, level, steelPath: false, modifiers: [] },
  });
  return must(evaluate(met, library, { assumptions }).trace[0], 'A hit');
};

describe('Corrosive Projection at max', () => {
  it('takes 18% of the armor, keeps the rest whole, and the armor factor names it', () => {
    const plain = hitOn('lancer', 60, { withAura: false });
    const stripped = hitOn('lancer', 60, { withAura: true });
    // What is left is kept whole, rounded down (T-48): 728 × 0.82 is 596.96, and 596 is left.
    expect(stripped.armor).toBe(Math.floor(must(plain.armor, 'Armor') * 0.82));
    expect(stripped.armor).toBe(596);
    const armor = must(
      stripped.factors.find(({ name, type }) => name === 'armor' && type === 'slash'),
      'An armor factor',
    );
    expect(armor.effects.map(({ source }) => source.name)).toEqual(['Corrosive Projection']);
  });

  /** A Heavy Gunner at level 100 would have 6,441 armor without the cap. */
  it('takes 18% of 2,700 from armor over the cap, unless strips come first (T-6)', () => {
    expect(hitOn('heavy-gunner', 100, { withAura: false }).armor).toBe(2700);
    expect(hitOn('heavy-gunner', 100, { withAura: true }).armor).toBeCloseTo(2214, 9);
    const after = { armorCappedBeforeStrips: false };
    expect(hitOn('heavy-gunner', 100, { withAura: true, assumptions: after }).armor).toBe(2700);
  });
});
