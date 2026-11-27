import { describe, expect, it } from 'vitest';

import { DEFAULT_ASSUMPTIONS } from '@/assumptions';

import { tickTimes } from './tickTimes';

const BLEED = { delay: 1, duration: 6 };
const GAS = { delay: 0, duration: 6 };
const TO_THE_END = { immediateDotsTickToTheEnd: true };

describe('a DoT’s ticks (the wiki’s Damage over Time page)', () => {
  it('come every second for 6 s: Slash, Toxin and Heat from 1 s', () => {
    expect(tickTimes(BLEED, 1, DEFAULT_ASSUMPTIONS)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('come from the proc for Electricity and Gas, whose tick at the end deals nothing', () => {
    expect(tickTimes(GAS, 1, DEFAULT_ASSUMPTIONS)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(tickTimes(GAS, 1, TO_THE_END)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('are ⌊D − 1⌋ + 1 with +30% status duration: 7.8 s gives 7', () => {
    expect(tickTimes(BLEED, 1.3, DEFAULT_ASSUMPTIONS)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(tickTimes(GAS, 1.3, DEFAULT_ASSUMPTIONS)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('go on to the end of an immediate DoT if T-8 says so', () => {
    expect(tickTimes(GAS, 1.3, TO_THE_END)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(tickTimes(BLEED, 1.3, TO_THE_END)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('are none for a DoT that ends before its first tick', () => {
    expect(tickTimes(BLEED, 0.1, DEFAULT_ASSUMPTIONS)).toEqual([]);
  });
});
