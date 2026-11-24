import { describe, expect, it } from 'vitest';

import { must } from '@/assert';
import {
  bucket,
  damageTypes,
  enemy,
  faction,
  family,
  libraryFile,
  module,
  referenceFiles,
  weapon,
} from '@/testing/fixtures';

import { formatError } from './libraryError';
import { loadLibrary } from './loadLibrary';
import type { LibraryFile } from './readItems';

const errorsOf = (files: readonly LibraryFile[]) => {
  const result = loadLibrary(files);
  return result.ok ? [] : result.errors.map(formatError);
};

/** The reference files with one of them, or more, swapped. */
const withFiles = (...files: readonly LibraryFile[]) => [
  ...referenceFiles.filter(({ path }) => !files.some((file) => file.path === path)),
  ...files,
];

const types = (...changes: readonly object[]) =>
  libraryFile(
    'damageTypes.json',
    ...damageTypes.map((type) => ({
      ...type,
      ...changes.find((change) => 'id' in change && change.id === type.id),
    })),
  );

const PRIMARIES = ['heat', 'cold', 'toxin'].map((id) => ({ id, group: 'primary' }));
const BLAST = { id: 'blast', group: 'secondary', combinesFrom: ['heat', 'cold'] };

describe('the reference files', () => {
  it('load', () => {
    const result = loadLibrary(referenceFiles);
    if (!result.ok) throw new Error(result.errors.map(formatError).join('\n'));
    const { damageTypes: rules, buckets, factions } = result.library;
    expect([rules.size, buckets.size, factions.size]).toEqual([20, 2, 1]);
  });

  it.each(['damageTypes.json', 'buckets.json', 'factions.json'])('need %s', (name) => {
    expect(errorsOf(referenceFiles.filter(({ path }) => path !== name))).toEqual([
      `${name}: The library needs this file`,
    ]);
  });

  it('are not checked against each other while one is broken', () => {
    const broken = { path: 'buckets.json', text: '{' };
    const errors = errorsOf([...withFiles(broken), libraryFile('mods/a.json', module)]);
    expect(errors).toEqual([expect.stringMatching(/^buckets\.json: Not valid JSON/)]);
  });
});

describe('damage types', () => {
  it('accept secondaries with two primaries each', () => {
    const viral = { id: 'viral', group: 'secondary', combinesFrom: ['cold', 'toxin'] };
    expect(errorsOf(withFiles(types(...PRIMARIES, BLAST, viral)))).toEqual([]);
  });

  it('are all there', () => {
    const some = damageTypes.filter(({ id }) => id !== 'tau' && id !== 'void');
    expect(errorsOf(withFiles(libraryFile('damageTypes.json', ...some)))).toEqual([
      'damageTypes.json: items: No entry for "void"',
      'damageTypes.json: items: No entry for "tau"',
    ]);
  });

  it('are there once', () => {
    const [first] = damageTypes;
    expect(errorsOf(withFiles(libraryFile('damageTypes.json', ...damageTypes, first)))).toEqual([
      'damageTypes.json: items[20].id: The id "impact" is already used by damageTypes.json: items[0]',
    ]);
  });

  it.each([
    ['a secondary without a pair', { id: 'blast', group: 'secondary' }, 'Secondaries, and'],
    ['a pair on a primary', { id: 'blast', combinesFrom: ['heat', 'cold'] }, 'Secondaries, and'],
    ['the same type twice', { ...BLAST, combinesFrom: ['heat', 'heat'] }, 'two different types'],
    ['three types', { ...BLAST, combinesFrom: ['heat', 'cold', 'toxin'] }, 'Too big'],
    ['an unknown layer', { id: 'blast', layers: { armor: 1 } }, 'Unrecognized key: "armor"'],
    ['an unknown group', { id: 'blast', group: 'elemental' }, 'Invalid option'],
  ])('refuse %s', (_name, change, message) => {
    const errors = errorsOf(withFiles(types(...PRIMARIES, change)));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(message);
  });

  it('refuse a part that is not a primary', () => {
    const radiation = { id: 'radiation', group: 'secondary', combinesFrom: ['heat', 'slash'] };
    expect(errorsOf(withFiles(types(...PRIMARIES, radiation)))).toEqual([
      'damageTypes.json: items[11].combinesFrom: "slash" is not a primary',
    ]);
  });

  it('refuse a pair that makes two types, in either order', () => {
    const gas = { id: 'gas', group: 'secondary', combinesFrom: ['cold', 'heat'] };
    expect(errorsOf(withFiles(types(...PRIMARIES, BLAST, gas)))).toEqual([
      'damageTypes.json: items[9].combinesFrom: cold + heat already makes "blast"',
    ]);
  });
});

describe('buckets and factions', () => {
  it.each([
    ['a stage', { stage: 'resolve' }],
    ['a scope', { scope: { beam: 1 } }],
    ['a scope count', { scope: { direct: 0 } }],
    ['a confidence', { confidence: 'X' }],
    ['members', { members: 'faction' }],
    ['a max', { max: 0 }],
  ])('refuse %s they do not know', (key, change) => {
    const [field = ''] = Object.keys(change);
    const errors = errorsOf(withFiles(libraryFile('buckets.json', { ...bucket, ...change })));
    expect(errors, key).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^buckets\\.json: items\\[0\\]\\.${field}`));
  });

  it('refuse a weakness to an unknown damage type', () => {
    const odd = { ...faction, damageProfile: { fire: 1.5 } };
    expect(errorsOf(withFiles(libraryFile('factions.json', odd)))).toEqual([
      'factions.json: items[0].damageProfile: Unrecognized key: "fire"',
    ]);
  });

  it('refuse an enemy of an unknown faction', () => {
    const enemies = libraryFile('enemies/a.json', enemy, { ...enemy, id: 'b', faction: 'corpse' });
    expect(errorsOf([...referenceFiles, enemies])).toEqual([
      'enemies/a.json: items[1].faction: "corpse" is not a faction (factions.json)',
    ]);
  });
});

describe('effects', () => {
  const [effect] = module.effects;
  const typo = { ...must(effect, 'no effect'), bucket: 'damage.bse' };
  const ok = { ...typo, bucket: 'damage.faction.grineer' };
  const attack = must(weapon.attacks[0], 'no attack');
  const choice = { ...module, id: 'choice', effects: [ok, typo] };
  const incarnon = {
    form: { ...attack, id: 'form' },
    charge: { source: 'weakPointHit', perHit: 1, max: 10 },
    evolutions: [{ tier: 2, choices: [module, choice] }],
  };

  it.each([
    ['a module', 'mods', { ...module, effects: [ok, typo] }, 'effects[1]'],
    ['a passive', 'weapons', { ...weapon, innatePassives: [typo] }, 'innatePassives[0]'],
    [
      'a zoom level',
      'weapons',
      { ...weapon, zoomLevels: [{ zoom: 2, effects: [ok, typo] }] },
      'zoomLevels[0].effects[1]',
    ],
    [
      'an evolution',
      'weapons',
      { ...weapon, incarnon },
      'incarnon.evolutions[0].choices[1].effects[1]',
    ],
  ])('of %s write into buckets that exist', (...[, folder, item, path]) => {
    expect(errorsOf([...referenceFiles, libraryFile(`${folder}/a.json`, item)])).toEqual([
      `${folder}/a.json: items[0].${path}.bucket: "damage.bse" is not a bucket (buckets.json)`,
    ]);
  });

  it('lock buckets that exist', () => {
    const acuity = { ...module, locks: ['damage.base', 'multishoot'] };
    expect(errorsOf([...referenceFiles, libraryFile('mods/a.json', acuity)])).toEqual([
      'mods/a.json: items[0].locks[1]: "multishoot" is not a bucket (buckets.json)',
    ]);
  });

  it('follow a new bucket without a code change', () => {
    const added = { ...bucket, id: 'damage.brandNew' };
    const files = withFiles(libraryFile('buckets.json', bucket, family, added));
    const mod = { ...module, effects: [{ ...effect, bucket: 'damage.brandNew' }] };
    expect(errorsOf([...files, libraryFile('mods/a.json', mod)])).toEqual([]);
  });
});
