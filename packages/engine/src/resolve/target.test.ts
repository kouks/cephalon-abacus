import { describe, expect, it } from 'vitest';

import { enemy, libraryFile, referenceFiles } from '@abacus/data/testing/fixtures';
import { loadLibrary } from '@abacus/data/load/loadLibrary';

import { findTarget } from './target';

const result = loadLibrary([...referenceFiles, libraryFile('enemies/a.json', enemy)]);
if (!result.ok) throw new Error('The fixtures are valid');
const { library } = result;

describe('a target', () => {
  it('can be the neutral dummy, which the library doesn’t have', () => {
    const dummy = findTarget('neutral-dummy', library);
    expect(dummy.faction).toBeUndefined();
    expect([...dummy.parts]).toEqual([
      ['body', { multiplier: 1, bodyParts: [] }],
      ['head', { multiplier: 3, bodyParts: ['head', 'weakPoint'], headcrit: 2 }],
    ]);
  });

  it('can be an enemy of the library, with its faction', () => {
    const { name, faction } = findTarget('test-enemy', library);
    expect([name, faction?.factionModGroup]).toEqual(['test-enemy', 'grineer']);
  });

  it('has to exist', () => {
    expect(() => findTarget('nobody', library)).toThrow('No enemy "nobody"');
  });
});
