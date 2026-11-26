import { describe, expect, it } from 'vitest';

import { compare } from './compare';
import { describeMismatch, isMatch } from './comparison';
import { loadFixtures } from './loadFixtures';
import { runOf } from './runOf';

/** What a result says about itself even when it is right: a test can be about a miss. */
const FINE = ['leftOut', 'enemyLeftOut', 'missesTarget'];

describe.each(loadFixtures())('$fixture.id: $fixture.question', ({ file, fixture }) => {
  it('is in a file of its name', () => {
    expect(file).toMatch(new RegExp(`^${fixture.id}-[a-z0-9-]+\\.json$`));
  });

  it.each(fixture.cases)('$name', ({ scenario, observed }) => {
    const run = runOf(fixture, scenario);
    expect(run.result.warnings.filter(({ code }) => !FINE.includes(code))).toEqual([]);

    const mismatches = compare(observed, run, fixture.tolerance)
      .filter((comparison) => !isMatch(comparison))
      .map(describeMismatch);
    expect(mismatches.join('\n\n')).toBe('');
  });
});
