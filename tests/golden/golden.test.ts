import { describe, expect, it } from 'vitest';

import { evaluate } from '@abacus/engine';

import { compare, describeMismatch, isMatch } from './compare';
import { libraryWith, loadFixtures } from './loadFixtures';

/** What a result says about itself even when it is right: a test can be about a miss. */
const FINE = ['leftOut', 'missesTarget'];

describe.each(loadFixtures())('$fixture.id: $fixture.question', ({ file, fixture }) => {
  it('is in a file of its name', () => {
    expect(file).toMatch(new RegExp(`^${fixture.id}-[a-z0-9-]+\\.json$`));
  });

  it.each(fixture.cases)('$name', ({ scenario, observed }) => {
    const result = evaluate(scenario, libraryWith(fixture));
    expect(result.warnings.filter(({ code }) => !FINE.includes(code))).toEqual([]);

    const mismatches = compare(observed, result, fixture.tolerance)
      .filter((comparison) => !isMatch(comparison))
      .map(describeMismatch);
    expect(mismatches.join('\n\n')).toBe('');
  });
});
