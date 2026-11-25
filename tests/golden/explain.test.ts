import { expect, it } from 'vitest';

import { explainHit } from './explain';

const source = { id: 'serration', name: 'Serration' };
const effects = [{ source, bucket: 'damage.base', op: 'STACKING_MULTIPLY', value: 1.65 } as const];

/** 200 slash and 100 heat before crits, which double it on average. */
const hit = {
  perType: new Map([['slash', 400] as const, ['heat', 200] as const]),
  total: 600,
  crit: { expected: 2 },
  trace: {
    factors: [
      { name: 'base', value: 100, effects },
      { name: 'share', type: 'slash', value: 2, effects: [] },
      { name: 'share', type: 'heat', value: 1, effects: [] },
      { name: 'crit', value: 2, effects: [] },
      { name: 'share', type: 'cold', value: 0, effects: [] },
    ] as const,
  },
};

const rowsOf = (tier: number, observed: number) =>
  explainHit(hit, tier, observed)
    .split('\n')
    .map((line) => line.split(/ {2,}/));

it('shows what each factor would have to be', () => {
  // A yellow hit of 900, so crits multiply by 3, but 990 was seen.
  expect(rowsOf(900, 990)).toEqual([
    ['10% off'],
    ['factor', 'type', 'value', 'would match at', 'from'],
    ['base', 'all', '100', '110', 'Serration 1.65'],
    ['share', 'slash', '2', '2.3'],
    ['share', 'heat', '1', '1.3'],
    ['crit', 'all', '3', '3.3'],
    ['share', 'cold', '0', 'Infinity'],
  ]);
});

it('says how far too high it is, too', () => {
  expect(rowsOf(900, 450)[0]).toEqual(['-50% off']);
});

it('has no answer for a hit that deals nothing, and shows the factor that is 0', () => {
  const factors = [...hit.trace.factors, { name: 'range', value: 0, effects: [] } as const];
  const perType = new Map([['slash', 0] as const, ['heat', 0] as const]);
  const missed = { ...hit, perType, total: 0, trace: { factors } };
  const rows = explainHit(missed, 0, 22).split('\n');
  expect(rows[0]).toBe('It deals nothing');
  expect(rows.at(-1)?.split(/ {2,}/)).toEqual(['range', 'all', '0', '-']);
  expect(rows.join()).not.toMatch(/NaN|Infinity/);
});
