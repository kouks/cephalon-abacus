import { describe, expect, it } from 'vitest';

import { DEFAULT_ASSUMPTIONS } from '@/assumptions';
import { makeLibrary } from '@/testing/build';

import { dotRulesOf } from './dotRules';

const library = makeLibrary([]);

describe('the statuses that tick', () => {
  const rules = dotRulesOf(library, DEFAULT_ASSUMPTIONS);

  it('are those with a dot, and nothing else', () => {
    expect([...rules.keys()]).toEqual(['bleed', 'ignite', 'tesla-chain', 'poison', 'gas-cloud']);
  });

  it('carry how long a stack lasts, the type they deal, and how far they reach', () => {
    expect(rules.get('tesla-chain')).toEqual({
      status: 'tesla-chain',
      coefficient: 0.5,
      delay: 0,
      dealsAs: 'electricity',
      reach: 3,
      duration: 6,
      elements: ['electricity'],
    });
    expect(rules.get('bleed')).toMatchObject({
      dealsAs: 'cinematic',
      elements: [],
    });
  });

  it('give Gas its components only if T-8 says so', () => {
    const both = dotRulesOf(library, { ...DEFAULT_ASSUMPTIONS, dotsTakeComponentBonuses: true });
    expect(rules.get('gas-cloud')?.elements).toEqual(['gas']);
    expect(both.get('gas-cloud')?.elements).toEqual(['gas', 'heat', 'toxin']);
    expect(both.get('poison')?.elements).toEqual(['toxin']);
  });
});
