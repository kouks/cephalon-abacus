import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';
import type { GoldenFixture, Observed } from '@abacus/data/schema/goldenFixture';
import { evaluate } from '@abacus/engine';

import { compare, describeMismatch, isMatch } from './compare';
import { libraryWith, loadFixtures } from './loadFixtures';

const fixtureOf = (id: string): GoldenFixture =>
  must(
    loadFixtures().find(({ fixture }) => fixture.id === id),
    `No fixture ${id}`,
  ).fixture;

/** A fixture's first case, as if something else had been seen. */
const mismatchesOf = (id: string, observed: Observed, caseIndex = 0) => {
  const fixture = fixtureOf(id);
  const { scenario } = must(fixture.cases[caseIndex], 'No such case');
  const result = evaluate(scenario, libraryWith(fixture));
  return compare(observed, result, fixture.tolerance)
    .filter((comparison) => !isMatch(comparison))
    .map(describeMismatch);
};

describe('a mismatch', () => {
  it('is none when all agrees', () => {
    expect(mismatchesOf('T-1', { hits: { white: 29, yellow: 46 } })).toEqual([]);
  });

  it('of a hit comes with its factors', () => {
    const [line = ''] = mismatchesOf('T-1', { hits: { white: 28, yellow: 46 } });
    expect(line.split('\n')[0]).toMatch(/^white hit: reported 28, computed 28\.875/);
    expect(line).toMatch(/^vulnerability +slash +1\.5 +1\.39394$/m);
  });

  it('can be a colour that never shows', () => {
    const [line = ''] = mismatchesOf('T-1', { hits: { orange: 64 } });
    expect(line).toBe(
      'orange hit: reported 64, computed nothing\nNo orange hit can happen at this crit chance',
    );
  });

  it('can be in the arsenal', () => {
    const seen = {
      arsenalDamage: { blast: 39.6, viral: 41.8 },
      arsenal: { multishot: 2, none: 1 },
    };
    expect(mismatchesOf('T-3', seen)).toEqual([
      'arsenal viral: reported 41.8, computed nothing',
      'arsenal multishot: reported 2, computed 1',
      'arsenal none: reported 1, computed nothing',
    ]);
  });

  it('can be in the time it takes', () => {
    const seen = { firing: [{ shots: 30, seconds: 3.8 } as const] };
    expect(mismatchesOf('T-17', seen)).toEqual([
      expect.stringMatching(/^seconds for 30 shots: reported 3\.8, computed 3\.22/),
    ]);
    const magazine = { firing: [{ shots: 'magazine', seconds: 7.7 } as const] };
    expect(mismatchesOf('T-18', magazine)).toEqual([
      expect.stringMatching(/^seconds for a magazine: reported 7\.7, computed 15\.4/),
    ]);
  });

  it('can be a proc that should not happen', () => {
    expect(mismatchesOf('T-14', { neverProcs: ['slash', 'impact'] })).toEqual([
      expect.stringMatching(/^impact proc weight: reported 0, computed 0\.\d+$/),
    ]);
  });

  it('needs to be about one part', () => {
    const fixture = fixtureOf('T-1');
    const { scenario } = must(fixture.cases[0], 'No case');
    const both = { ...scenario, aim: { head: 0.5, body: 0.5 } };
    const result = evaluate(both, libraryWith(fixture));
    const seen = { hits: { white: 29 } };
    expect(() => compare(seen, result, {})).toThrow('A fixture aims at one part');
  });
});

describe('a tolerance', () => {
  const comparison = { what: 'hit', observed: 29, tolerance: 0.5 };

  it.each([
    [28.5, true],
    [29.5, true],
    [28.49, false],
    [29.51, false],
    [undefined, false],
  ])('of 0.5 around 29, for %d: %s', (computed, expected) => {
    expect(isMatch({ ...comparison, computed })).toBe(expected);
  });
});
