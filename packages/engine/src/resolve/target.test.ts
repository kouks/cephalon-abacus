import { describe, expect, it } from 'vitest';

import { enemy, libraryFile, referenceFiles } from '@abacus/data/testing/fixtures';
import { loadLibrary } from '@abacus/data/load/loadLibrary';

import { findTarget } from './target';

const CHARGER = {
  ...enemy,
  id: 'test-charger',
  bodyParts: [
    { id: 'body', multiplier: 0.5 },
    { id: 'head', multiplier: 1, countsAs: ['head', 'weakPoint'] },
    { id: 'maw', multiplier: 10, countsAs: ['weakPoint'], headcrit: 4 },
    { id: 'tank', multiplier: 1.5, countsAs: ['weakPoint'], promotes: true },
  ],
};

const result = loadLibrary([...referenceFiles, libraryFile('enemies/a.json', enemy, CHARGER)]);
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

  it('has the parts of its preset, and no others', () => {
    const { parts } = findTarget('test-charger', library);
    expect([...parts]).toEqual([
      ['body', { multiplier: 0.5, bodyParts: [] }],
      ['head', { multiplier: 1, bodyParts: ['head', 'weakPoint'] }],
      ['maw', { multiplier: 10, bodyParts: ['weakPoint'], headcrit: 4 }],
      ['tank', { multiplier: 1.5, bodyParts: ['weakPoint'], raises: [{ chance: 1, from: 0 }] }],
    ]);
  });

  it('has to exist', () => {
    expect(() => findTarget('nobody', library)).toThrow('No enemy "nobody"');
  });
});
