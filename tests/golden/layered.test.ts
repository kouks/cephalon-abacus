import { expect, it } from 'vitest';

import type { Layered } from '@abacus/data/schema/goldenFixture';

import { describeMismatch, isMatch } from './comparison';
import { compareLayered } from './layered';
import { runOn, WHITE } from './made';

const compared = (layered: readonly Layered[], layers: Parameters<typeof runOn>[0]) =>
  compareLayered({ layered }, runOn(layers), { hits: 0.5 });

/** A white after another on 150 shields: 46.875 left, so 2.8 of the rest reaches health. */
const breaking: Layered = {
  before: { white: 1 },
  colour: 'white',
  shown: { shield: 100, health: 3 },
};

it('the hit that breaks shields shows the rest of it on health, and the shield the hit less that', () => {
  expect(compared([breaking], { shield: 150 }).map(isMatch)).toEqual([true, true]);
});

it('a hit on a fresh enemy shows on its first layer', () => {
  const fresh: Layered = { colour: 'white', shown: { shield: 103 } };
  expect(compared([fresh], { shield: 1000 }).map(isMatch)).toEqual([true]);
});

it('a mismatch says what each layer showed and lost, and what was left', () => {
  const wrong = { ...breaking, shown: { shield: 586 } };
  const [line] = compared([wrong], { shield: 150, health: 1000 }).map(describeMismatch);
  expect(line?.split('\n')).toEqual([
    'white hit, shown on shield: reported 586, computed 100',
    'shield: shows 100, loses 46.875',
    'health: shows 3, loses 2.8125',
    `left after: overguard 0, shield 0, health ${Number((1000 - (WHITE - 46.875) * 0.05).toPrecision(8))}`,
  ]);
});

it('a layer the hit didn’t reach shows nothing', () => {
  const [entry] = compared([{ colour: 'white', shown: { health: 103 } }], { shield: 1000 });
  expect(entry?.computed).toBeUndefined();
});
