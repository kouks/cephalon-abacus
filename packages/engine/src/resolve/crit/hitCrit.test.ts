import { expect, it } from 'vitest';

import { add } from '@/testing/build';
import { attackWith, measureCrit } from '@/testing/crit';

const effects = [
  add('crit.chance', 1.5),
  add('crit.chanceWeakPoint', 3.5),
  add('crit.chanceFlat', 0.45, { op: 'ADD' }),
  add('crit.damage', 1.2),
];

const onHead = (change: object = {}) =>
  measureCrit({
    attack: attackWith(0.3, 2),
    effects,
    bodyParts: ['head', 'weakPoint'],
    location: { headcrit: 2, ...change },
  });

it('names every term behind a hit’s crit', () => {
  const { chance, multiplier } = onHead();
  const terms = [...chance.totals, ...multiplier.totals].map(
    ({ bucket, stacking, add: added, contributions }) =>
      `${bucket}: +${stacking} +${added}, from ${contributions.length}`,
  );
  expect(terms).toEqual([
    'crit.chance: +1.5 +0, from 1',
    'crit.chanceCombo: +0 +0, from 0',
    'crit.chanceWeakPoint: +3.5 +0, from 1',
    'crit.chanceFlat: +0 +0.45, from 1',
    'crit.damage: +1.2 +0, from 1',
    'crit.damageFlat: +0 +0, from 0',
    'crit.damageFinal: +0 +0, from 0',
  ]);
  expect([chance.base, multiplier.base, multiplier.headcrit]).toEqual([0.3, (256 * 32) / 4095, 2]);
});

it('goes from those terms to tiers and their mean', () => {
  const { chance, multiplier, tiers, expected } = onHead();
  expect(chance.value).toBeCloseTo(0.3 * 6 + 0.45, 12);
  expect(multiplier.value).toBeCloseTo(((256 * 32) / 4095) * 2.2 * 2, 12);
  expect(tiers.map(({ tier }) => tier)).toEqual([2, 3]);
  expect(expected).toBeCloseTo(1 + 2.25 * (multiplier.value - 1), 12);
});

it('raises tiers where the part or the build does', () => {
  const { tiers } = onHead({ raises: [{ chance: 1, from: 0 }] });
  expect(tiers.map(({ tier }) => tier)).toEqual([3, 4]);
});

it('shows Cold as a source of its own', () => {
  const { multiplier } = measureCrit({ coldStacks: 1 });
  const sources = multiplier.totals.flatMap(({ contributions }) =>
    contributions.map(({ source, value }) => `${source.name} ${value}`),
  );
  expect(sources).toEqual(['freeze 0.1']);
});
