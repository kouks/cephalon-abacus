import { describe, expect, it } from 'vitest';

import { must } from '@/assert';
import {
  attack,
  damageTypes,
  enemy,
  libraryFile,
  module,
  referenceFiles,
  weapon,
} from '@/testing/fixtures';

import { formatError } from './libraryError';
import { loadLibrary } from './loadLibrary';
import type { LibraryFile } from './readItems';

const load = (...files: readonly LibraryFile[]) => {
  const result = loadLibrary([...referenceFiles, ...files]);
  if (!result.ok) throw new Error(result.errors.map(formatError).join('\n'));
  return result.library;
};

const errorsOf = (...files: readonly LibraryFile[]) => {
  const result = loadLibrary([...referenceFiles, ...files]);
  return result.ok ? [] : result.errors.map(formatError);
};

const inWeapon = (change: object) => libraryFile('weapons/a.json', { ...weapon, ...change });
const inAttack = (change: object) => inWeapon({ attacks: [{ ...attack, ...change }] });
const inModule = (change: object) => libraryFile('mods/a.json', { ...module, ...change });
const inEffect = (change: object) => inModule({ effects: [{ ...module.effects[0], ...change }] });

describe('a valid library', () => {
  it('has no items without item files', () => {
    const { weapons, modules, enemies } = load();
    expect([weapons.size, modules.size, enemies.size]).toEqual([0, 0, 0]);
  });

  it('indexes every collection by id', () => {
    const library = load(
      libraryFile('weapons/rifles.json', weapon, { ...weapon, id: 'other-rifle' }),
      libraryFile('mods/rifle.json', module),
      libraryFile('arcanes/primary.json', { ...module, id: 'test-arcane', kind: 'arcane' }),
      libraryFile('buffs/roar.json', { ...module, id: 'test-buff', kind: 'buff' }),
      libraryFile('enemies/grineer.json', enemy),
    );
    expect([...library.weapons.keys()]).toEqual(['test-rifle', 'other-rifle']);
    expect([...library.modules.keys()]).toEqual(['test-mod', 'test-arcane', 'test-buff']);
    expect([...library.enemies.keys()]).toEqual(['test-enemy']);
  });

  it('keeps the data as written', () => {
    expect(load(inWeapon({})).weapons.get('test-rifle')).toEqual(weapon);
  });

  it('lets a weapon and a mod share an id', () => {
    const library = load(inWeapon({ id: 'same' }), inModule({ id: 'same' }));
    expect([library.weapons.has('same'), library.modules.has('same')]).toEqual([true, true]);
  });

  it('freezes items all the way down', () => {
    const loaded = must(load(inWeapon({})).weapons.get('test-rifle'), 'no weapon');
    const first = must(loaded.attacks[0], 'no attack');
    const parts = [loaded, loaded.class, loaded.ammo, loaded.attacks, first, first.damage];
    expect(parts.map((part) => Object.isFrozen(part))).toEqual(parts.map(() => true));
  });
});

describe('a bad file', () => {
  it('that is not JSON', () => {
    const [error] = errorsOf({ path: 'mods/a.json', text: '{"a":' });
    expect(error).toMatch(/^mods\/a\.json: Not valid JSON: ./);
  });

  it('without an envelope', () => {
    expect(errorsOf({ path: 'mods/a.json', text: '[]' })).toEqual([
      'mods/a.json: Invalid input: expected object, received array',
    ]);
  });

  it('with a bad envelope', () => {
    const text = JSON.stringify({
      schemaVersion: 2,
      gameVersion: 'U44',
      source: 'wiki',
      items: [],
    });
    expect(errorsOf({ path: 'mods/a.json', text })).toEqual([
      'mods/a.json: schemaVersion: Invalid input: expected 1',
      'mods/a.json: gameVersion: Expected a game version, e.g. "44.1.4.1"',
      'mods/a.json: source: Expected an https URL',
    ]);
  });

  it('in an unknown folder', () => {
    expect(errorsOf(libraryFile('rifles/a.json', weapon))).toEqual([
      'rifles/a.json: No schema for this file. Places: damageTypes.json, buckets.json, factions.json, scaling.json, statuses.json, weapons, mods, arcanes, buffs, enemies',
    ]);
  });
});

describe('a bad item', () => {
  it.each([
    ['source', undefined, 'Expected an https URL'],
    ['source', 'http://wiki.warframe.com/w/A', 'Expected an https URL'],
    [
      'source',
      'https://warframe.fandom.com/wiki/Serration',
      'The Fandom wiki is stale; cite wiki.warframe.com',
    ],
    ['gameVersion', undefined, 'Invalid input: expected string, received undefined'],
    ['gameVersion', 'U44', 'Expected a game version, e.g. "44.1.4.1"'],
    ['id', 'Test_Mod', 'Expected a lower-kebab id, e.g. "primed-bane"'],
    ['kind', 'perk', expect.stringContaining('Invalid option: expected one of "mod"|') as string],
    ['rank.perRank', { max: 5, perRank: [1, 2] }, 'Expected one share for each rank from 0 to max'],
  ])('module %s: %s', (path, value, message) => {
    const key = path.split('.')[0] ?? '';
    const [error, ...others] = errorsOf(inModule({ [key]: value }));
    expect(error?.replace(`mods/a.json: items[0].${path}: `, '')).toEqual(message);
    expect(others).toEqual([]);
  });

  it.each([
    ['an unknown class', { classes: ['riffle'] }, 'classes[0]: "riffle" is not a weapon class'],
    ['a lower-case tag', { tags: ['aoe'] }, 'tags[0]: Expected an upper-case tag, e.g. "AOE"'],
  ])('compat with %s', (_name, change, message) => {
    const [error] = errorsOf(inModule({ compat: { slots: ['primary'], ...change } }));
    expect(error).toContain(`mods/a.json: items[0].compat.${message}`);
  });

  it.each([
    ['op', 'PLUS', 'op: Invalid option: expected one of "STACKING_MULTIPLY"|'],
    ['value', '165%', 'value: Expected a number, or { value, times'],
    ['bucket', 'Damage', 'bucket: Expected a bucket, e.g. "damage.base"'],
    [
      'condition',
      { trigger: 'onStatus:fire', target: 'self' },
      'condition.trigger: Expected a trigger, e.g. "onKill" or "onStatus:cold"',
    ],
  ])('effect %s', (key, value, message) => {
    const [error] = errorsOf(inEffect({ [key]: value }));
    expect(error).toContain(`mods/a.json: items[0].effects[0].${message}`);
  });

  it.each([
    ['a misspelt field', { critchance: 1 }, ': Unrecognized key: "critchance"'],
    ['text for a number', { critChance: '20%' }, '.critChance: Invalid input: expected number'],
    ['a negative chance', { critChance: -1 }, '.critChance: Too small: expected number to be >=0'],
    ['an unknown damage type', { damage: { fire: 3 } }, '.damage: Unrecognized key: "fire"'],
    ['no damage', { damage: {} }, '.damage: An attack deals at least one damage type'],
    [
      'a charge without a time',
      { trigger: 'charge', afterCharge: 'reload' },
      '.chargeTime: "charge" needs chargeTime',
    ],
    [
      'a charge followed by nobody knows what',
      { trigger: 'charge', chargeTime: 1 },
      '.afterCharge: "charge" needs afterCharge',
    ],
    ['a beam without a ramp', { shotType: 'continuous' }, '.beam: "continuous" needs beam'],
    ['a spool without shots', { trigger: 'autoSpool' }, '.spool: "autoSpool" needs spool'],
    ['an explosion without a radius', { shotType: 'aoe' }, '.aoe: "aoe" needs aoe'],
  ])('attack with %s', (_name, change, message) => {
    const errors = errorsOf(inAttack(change));
    expect(errors).toEqual([
      expect.stringContaining(`weapons/a.json: items[0].attacks[0]${message}`),
    ]);
  });

  it('reports both fields a burst is missing', () => {
    expect(errorsOf(inAttack({ trigger: 'burst' }))).toEqual([
      'weapons/a.json: items[0].attacks[0].burstCount: "burst" needs burstCount',
      'weapons/a.json: items[0].attacks[0].burstDelay: "burst" needs burstDelay',
    ]);
  });

  it("doesn't hide the errors of others", () => {
    const file = libraryFile('mods/a.json', { ...module, id: 1 }, module, { ...module, kind: 'x' });
    const places = errorsOf(file, inWeapon({ maxRank: 35 })).map((error) => error.split(': ')[1]);
    expect(places).toEqual(['items[0].maxRank', 'items[0].id', 'items[2].kind']);
  });
});

describe('cross-references', () => {
  it('finds an id used twice, across files', () => {
    const files = [libraryFile('mods/a.json', module), libraryFile('arcanes/b.json', module)];
    expect(errorsOf(...files)).toEqual([
      'arcanes/b.json: items[0].id: The id "test-mod" is already used by mods/a.json: items[0]',
    ]);
  });

  it('resolves linked attacks', () => {
    const aoe = { radius: 5, centerPct: 1, edgePct: 0.5, losRequired: true };
    const explosion = { ...attack, id: 'explosion', shotType: 'aoe', aoe };
    const attacks = [{ ...attack, linkedAttacks: ['explosion'] }, explosion];
    expect(errorsOf(inWeapon({ attacks }))).toEqual([]);
  });

  it.each(['explosion', 'normal'])('refuses a link from "normal" to "%s"', (target) => {
    expect(errorsOf(inAttack({ linkedAttacks: [target] }))).toEqual([
      `weapons/a.json: items[0].attacks[0].linkedAttacks[0]: No other attack here has the id "${target}"`,
    ]);
  });

  it('finds an attack id used twice in a weapon', () => {
    expect(errorsOf(inWeapon({ attacks: [attack, attack] }))).toEqual([
      'weapons/a.json: items[0].attacks[1].id: Another attack of this weapon has the id "normal"',
    ]);
  });
});

describe('statuses.json', () => {
  it('has every status a damage type procs', () => {
    const [first, ...rest] = damageTypes;
    const procs = libraryFile('damageTypes.json', { ...first, proc: 'nowhere' }, ...rest);
    const files = [procs, ...referenceFiles.filter(({ path }) => path !== 'damageTypes.json')];
    const result = loadLibrary(files);
    expect(result.ok ? [] : result.errors.map(formatError)).toEqual([
      'damageTypes.json: items[0].proc: No status "nowhere" in statuses.json',
    ]);
  });
});

describe('a forced proc', () => {
  it('names a status in statuses.json', () => {
    const forced = { ...attack, forcedProcs: [{ status: 'nowhere', count: 1 }] };
    const result = loadLibrary([
      ...referenceFiles,
      libraryFile('weapons/a.json', { ...weapon, attacks: [forced] }),
    ]);
    expect(result.ok ? [] : result.errors.map(formatError)).toEqual([
      'weapons/a.json: items[0].attacks[0].forcedProcs[0].status: No status "nowhere" in statuses.json',
    ]);
  });
});
