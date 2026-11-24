import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import { hitCrit } from '#engine/resolve/crit/hitCrit.ts';

import { realAttack, realLibrary as library } from './realAttack.ts';

type Hit = { readonly modules: readonly string[]; readonly on?: 'body' | 'head' };

const crit = (weaponId: string, { modules, on = 'body' }: Hit) => {
  const [first] = must(library.weapons.get(weaponId), `No weapon "${weaponId}"`).attacks;
  const bodyParts = on === 'head' ? (['head', 'weakPoint'] as const) : [];
  const { id } = must(first, `"${weaponId}" has no attack`);
  const { attack, totals, assumptions } = realAttack(weaponId, id, { modules, bodyParts });
  return hitCrit(attack, { totals, assumptions, headcrit: on === 'head' ? 2 : 1 });
};

describe('the seed weapons', () => {
  it('can all crit', () => {
    const chances = [...library.weapons.values()].map(
      ({ id }) => `${id} ${crit(id, { modules: [] }).chance.value}`,
    );
    expect(chances.filter((line) => line.endsWith(' 0'))).toEqual([]);
  });

  it('paris with Point Strike and Vital Sense averages 3.55x', () => {
    const { chance, expected } = crit('paris', { modules: ['point-strike', 'vital-sense'] });
    expect(chance.value).toBeCloseTo(0.75, 12);
    expect(expected).toBeCloseTo(3.55, 2);
  });

  it('get Acuity’s crit chance on weak points only', () => {
    const modules = ['primary-acuity'];
    expect(crit('vectis-prime', { modules }).chance.value).toBeCloseTo(0.3, 12);
    const onHead = crit('vectis-prime', { modules, on: 'head' }).chance.value;
    expect(onHead).toBeCloseTo(0.3 * (1 + 3.498), 12);
  });
});
