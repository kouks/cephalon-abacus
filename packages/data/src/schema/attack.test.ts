import { expect, it } from 'vitest';

import { attack } from '@/testing/fixtures';

import { attackSchema } from './attack';

const explosion = { radius: 4, centerPct: 1, edgePct: 0.5, losRequired: false };

it.each([
  ['with falloff', {}, true],
  ['without', { edgePct: 1 }, true],
  ['down to nothing', { edgePct: 0 }, true],
  ['weaker in its centre', { centerPct: 0.5 }, true],
  ['with nothing in its centre', { centerPct: 0, edgePct: 0 }, false],
  ['stronger at its radius', { centerPct: 0.4 }, false],
  ['of no size', { radius: 0 }, false],
])('an explosion %s', (_name, change, isValid) => {
  const aoe = { ...explosion, ...change };
  expect(attackSchema.safeParse({ ...attack, aoe }).success).toBe(isValid);
});
