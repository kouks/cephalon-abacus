import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { BODY, factorOf, HEAD, hit, WEAK_POINT } from '@/testing/hit';

import type { TargetPart } from '../target';

const weakPoint = (id: string, value: number) =>
  mod(id, [add('weakPoint.damage', value, { op: 'ADD' })]);
const headshot = (id: string, value: number) => mod(id, [add('headshot.damage', value)]);

const ACUITY = weakPoint('acuity', 3.5);
const SEEK = weakPoint('seek', 0.75);
const DEADHEAD = headshot('deadhead', 0.3);
const PROWL = headshot('prowl', 0.4);

const multiplier = (part: TargetPart, ...modules: readonly { id: string }[]) =>
  factorOf(hit({ modules }, part), 'bodyPart').value;

describe('the body part multiplier', () => {
  it('is the part’s own without bonuses', () => {
    expect([BODY, HEAD, WEAK_POINT].map((part) => multiplier(part))).toEqual([1, 3, 1]);
  });

  it('of a 3x head with Acuity and Seek is 9.375x', () => {
    expect(multiplier(HEAD, ACUITY, SEEK)).toBeCloseTo(9.375, 12);
  });

  it('of a 1x weak point with Acuity and Seek is 5.25x', () => {
    expect(multiplier(WEAK_POINT, ACUITY, SEEK)).toBeCloseTo(5.25, 12);
  });

  it('of Butcher’s 3x head with Acuity is 8.25x', () => {
    expect(multiplier(HEAD, ACUITY)).toBeCloseTo(8.25, 12);
  });

  it('of a 3x head with Acuity, Seek, Deadhead and Prowl is 15.9375x', () => {
    expect(multiplier(HEAD, ACUITY, SEEK, DEADHEAD, PROWL)).toBeCloseTo(15.9375, 12);
  });

  it('ignores both kinds of bonus on the body', () => {
    expect(multiplier(BODY, ACUITY, DEADHEAD)).toBe(1);
  });

  it('counts each kind only where it belongs', () => {
    expect(multiplier(WEAK_POINT, DEADHEAD)).toBe(1);
    const skull: TargetPart = { multiplier: 3, bodyParts: ['head'] };
    expect(multiplier(skull, ACUITY)).toBe(3);
    expect(multiplier(skull, DEADHEAD)).toBeCloseTo(3.9, 12);
  });

  it('names its bonuses', () => {
    const { effects } = factorOf(hit({ modules: [ACUITY, DEADHEAD] }, HEAD), 'bodyPart');
    expect(effects.map(({ source }) => source.name)).toEqual(['acuity', 'deadhead']);
  });

  it('can be 0x', () => {
    const shell: TargetPart = { multiplier: 0, bodyParts: [] };
    expect(hit({}, shell).total).toBe(0);
  });
});
