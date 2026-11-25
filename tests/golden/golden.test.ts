import { describe, expect, it } from 'vitest';

import { evaluate } from '@abacus/engine';

import { compare, describeMismatch, isMatch } from './compare';
import { libraryWith, loadFixtures } from './loadFixtures';

describe.each(loadFixtures())('$fixture.id: $fixture.question', ({ file, fixture }) => {
  it('is in a file of its name', () => {
    expect(file).toMatch(new RegExp(`^${fixture.id}-[a-z0-9-]+\\.json$`));
  });

  it.each(fixture.cases)('$name', ({ scenario, observed }) => {
    const result = evaluate(scenario, libraryWith(fixture));
    expect(result.warnings.filter(({ code }) => code !== 'leftOut')).toEqual([]);

    const mismatches = compare(observed, result, fixture.tolerance)
      .filter((comparison) => !isMatch(comparison))
      .map(describeMismatch);
    expect(mismatches.join('\n\n')).toBe('');
  });
});
