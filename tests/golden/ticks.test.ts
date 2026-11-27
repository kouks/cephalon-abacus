import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';
import type { GoldenFixture, Observed } from '@abacus/data/schema/goldenFixture';

import { compare } from './compare';
import { describeMismatch, isMatch } from './comparison';
import { loadFixtures } from './loadFixtures';
import { runOf } from './runOf';

const T23 = must(
  loadFixtures().find(({ fixture }) => fixture.id === 'T-23'),
  'No T-23',
).fixture;

/** T-23's first case, Tigris Prime up close, as if these ticks had been seen. */
const ticksOf = (ticks: NonNullable<Observed['ticks']>, fixture: GoldenFixture = T23) => {
  const { scenario } = must(fixture.cases[0], 'No case');
  return compare({ ticks }, runOf(fixture, scenario), fixture.tolerance);
};

describe('a tick', () => {
  it('is the tick of the proc of a hit of that colour', () => {
    const [white, yellow] = ticksOf([
      { status: 'bleed', of: 'white', shown: 69 },
      { status: 'bleed', of: 'yellow', shown: 137 },
    ]);
    expect([white?.computed, yellow?.computed]).toEqual([
      expect.closeTo(68.6, 3),
      expect.closeTo(196 * 0.35 * 2, 0),
    ]);
    expect(white && isMatch(white)).toBe(true);
  });

  it('that differs comes with its factors, and what each would have to be', () => {
    const [mismatch] = ticksOf([{ status: 'bleed', of: 'white', shown: 103 }]);
    const line = describeMismatch(must(mismatch, 'A comparison'));
    expect(line.split('\n')[0]).toMatch(
      /^bleed tick of a white hit: reported 103, computed 68\.59999/,
    );
    expect(line).toMatch(/^coefficient +0\.35 +0\.525/m);
  });

  it('of a status the hit doesn’t inflict is computed as nothing', () => {
    const [none] = ticksOf([{ status: 'poison', of: 'white', shown: 10 }]);
    expect(none && [none.computed, isMatch(none), describeMismatch(none)]).toEqual([
      undefined,
      false,
      'poison tick of a white hit: reported 10, computed nothing\nThe hit inflicts no poison of this tier',
    ]);
  });
});
