import { describe, expect, it } from 'vitest';

import { STAGES } from '#data/schema/bucket.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

const { damageTypes, buckets, factions } = loadRealLibrary();

/** "impact 1.5, heat 0.5" */
const describeMap = (map: object) =>
  Object.entries(map)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(', ');

describe('damageTypes.json', () => {
  const rules = [...damageTypes.values()];

  it('has the 20 types in their groups', () => {
    const groups = rules.map(({ group }) => group);
    const count = (name: string) => groups.filter((group) => group === name).length;
    expect(['physical', 'primary', 'secondary', 'special'].map(count)).toEqual([3, 4, 6, 7]);
  });

  it('makes every secondary from two primaries, and every pair of primaries once', () => {
    const pairs = rules
      .filter(({ group }) => group === 'secondary')
      .map(({ id, combinesFrom = [] }) => `${combinesFrom.join(' + ')} = ${id}`);
    expect(pairs).toEqual([
      'heat + cold = blast',
      'electricity + toxin = corrosive',
      'heat + toxin = gas',
      'cold + electricity = magnetic',
      'heat + electricity = radiation',
      'cold + toxin = viral',
    ]);
  });

  it('has the layer rules of BIBLE §10', () => {
    const special = rules
      .map(({ id, layers, bypassArmor }) => {
        const armor = bypassArmor ? ', ignores armor' : '';
        return `${id}: ${describeMap(layers)}${armor}`;
      })
      .filter((rule) => !rule.endsWith(': overguard 1, shield 1, health 1'));
    expect(special).toEqual([
      'toxin: overguard 1, health 1',
      'void: overguard 1.5, shield 1, health 1',
      'true: overguard 1, health 1, ignores armor',
      'cinematic: overguard 1, shield 1, health 1, ignores armor',
      'finisher: overguard 1, shield 1, health 1, ignores armor',
      'shield-drain: overguard 1, shield 1',
      'energy-drain: ',
    ]);
  });

  it('gives a proc to every type that has one', () => {
    const without = rules.filter(({ proc }) => proc === undefined).map(({ id }) => id);
    expect(without).toEqual(['true', 'cinematic', 'finisher', 'shield-drain', 'energy-drain']);
    const procs = rules.flatMap(({ proc = [] }) => proc);
    expect(new Set(procs).size).toBe(15);
  });
});

describe('factions.json', () => {
  it('has the table of BIBLE §10', () => {
    const table = [...factions.values()].map(
      ({ id, damageProfile, factionModGroup = '-' }) =>
        `${id} (${factionModGroup}): ${describeMap(damageProfile)}`,
    );
    expect(table).toMatchInlineSnapshot(`
      [
        "grineer (grineer): impact 1.5, corrosive 1.5",
        "kuva-grineer (grineer): impact 1.5, corrosive 1.5, heat 0.5",
        "scaldra (scaldra): impact 1.5, corrosive 1.5, gas 0.5",
        "corpus (corpus): puncture 1.5, magnetic 1.5",
        "corpus-amalgam (corpus): electricity 1.5, magnetic 1.5, blast 0.5",
        "techrot (techrot): magnetic 1.5, gas 1.5, cold 0.5",
        "infested (infested): slash 1.5, heat 1.5",
        "infested-deimos (infested): blast 1.5, gas 1.5, viral 0.5",
        "orokin (orokin): puncture 1.5, viral 1.5, radiation 0.5",
        "sentient (sentient): cold 1.5, radiation 1.5, corrosive 0.5",
        "narmer (-): slash 1.5, toxin 1.5, magnetic 0.5",
        "murmur (murmur): electricity 1.5, radiation 1.5, viral 0.5",
        "zariman (-): void 1.5",
        "anarchs (-): impact 1.5, electricity 1.5, radiation 0.5",
      ]
    `);
  });

  it('keeps the mod groups apart from the damage profiles', () => {
    const groupOf = (id: string) => factions.get(id)?.factionModGroup;
    expect(groupOf('kuva-grineer')).toBe('grineer');
    expect(groupOf('scaldra')).not.toBe('grineer');
    expect(groupOf('techrot')).not.toBe('infested');
    expect(groupOf('narmer')).toBeUndefined();
  });
});

describe('buckets.json', () => {
  const all = [...buckets.values()];

  it('limits three buckets to a body part', () => {
    const limited = all.flatMap(({ id, bodyPart }) =>
      bodyPart === undefined ? [] : [[id, bodyPart]],
    );
    expect(limited).toEqual([
      ['crit.chanceWeakPoint', 'weakPoint'],
      ['weakPoint.damage', 'weakPoint'],
      ['headshot.damage', 'head'],
    ]);
  });

  it('has every bucket of BIBLE §5', () => {
    const table = all.map(({ id, op, stage, scope, members = '', max = '' }) =>
      [id, op, stage, describeMap(scope), members, max].join(' | '),
    );
    expect(table).toMatchInlineSnapshot(`
      [
        "damage.base | STACKING_MULTIPLY | composition | direct 1, proc 1, extraHit 1, aoe 1 |  | ",
        "damage.ips | STACKING_MULTIPLY | composition | direct 1, aoe 1 | impact,puncture,slash | ",
        "damage.element | STACKING_MULTIPLY | composition | direct 1, proc 1, aoe 1 | heat,cold,electricity,toxin,blast,corrosive,gas,magnetic,radiation,viral | ",
        "damage.elementNoCombine | STACKING_MULTIPLY | composition | direct 1, proc 1, aoe 1 | heat,cold,electricity,toxin,blast,corrosive,gas,magnetic,radiation,viral | ",
        "damage.faction | STACKING_MULTIPLY | hit | direct 1, proc 2, extraHit 2, aoe 1 | factionModGroup | ",
        "damage.final | MULTIPLY | hit | direct 1, aoe 1 | any | ",
        "crit.chance | STACKING_MULTIPLY | stats | direct 1, proc 1, aoe 1 |  | ",
        "crit.chanceCombo | STACKING_MULTIPLY | stats | direct 1, aoe 1 |  | ",
        "crit.chanceFlat | ADD | crit | direct 1, aoe 1 |  | ",
        "crit.chanceWeakPoint | STACKING_MULTIPLY | crit | direct 1 |  | ",
        "crit.damage | STACKING_MULTIPLY | stats | direct 1, proc 1, aoe 1 |  | ",
        "crit.damageFlat | ADD | crit | direct 1, aoe 1 |  | ",
        "crit.damageFinal | MULTIPLY | crit | direct 1, aoe 1 |  | ",
        "status.chance | STACKING_MULTIPLY | stats | direct 1, aoe 1 |  | ",
        "status.chanceCombo | STACKING_MULTIPLY | stats | direct 1, aoe 1 |  | ",
        "status.chanceFlat | ADD | stats | direct 1, aoe 1 |  | ",
        "status.duration | STACKING_MULTIPLY | stats | proc 1 |  | ",
        "status.damage | STACKING_MULTIPLY | proc | proc 1 |  | ",
        "multishot | STACKING_MULTIPLY | stats | direct 1, aoe 1 |  | ",
        "fireRate | STACKING_MULTIPLY | stats |  |  | ",
        "reload | STACKING_MULTIPLY | stats |  |  | ",
        "magazine | STACKING_MULTIPLY | stats |  |  | ",
        "ammoMax | STACKING_MULTIPLY | stats |  |  | ",
        "ammoEfficiency | ADD | stats |  |  | 0.75",
        "weakPoint.damage | ADD | hit | direct 1 |  | ",
        "headshot.damage | STACKING_MULTIPLY | hit | direct 1 |  | ",
        "heavy.efficiency | ADD | combo |  |  | 0.9",
        "heavy.windUp | STACKING_MULTIPLY | stats |  |  | ",
        "combo.initial | ADD | combo |  |  | ",
        "combo.duration | ADD | combo |  |  | ",
        "range | ADD | stats |  |  | ",
        "aoeRadius | STACKING_MULTIPLY | stats |  |  | ",
        "punchThrough | ADD | stats |  |  | ",
        "projectileSpeed | STACKING_MULTIPLY | stats |  |  | ",
        "enemy | MULTIPLY | target |  | any | ",
      ]
    `);
  });

  it('names a valid stage for every bucket, and uses every stage', () => {
    expect(new Set(all.map(({ stage }) => stage))).toEqual(new Set(STAGES));
  });

  it('applies faction bonuses twice to DoTs and extra hits', () => {
    expect(buckets.get('damage.faction')?.scope).toEqual({
      direct: 1,
      proc: 2,
      extraHit: 2,
      aoe: 1,
    });
  });
});

describe('every item', () => {
  it('was checked against the version its file targets', () => {
    const versions = [...damageTypes.values(), ...buckets.values(), ...factions.values()].map(
      ({ gameVersion }) => gameVersion,
    );
    expect(new Set(versions)).toEqual(new Set(['44.1.4.1']));
  });
});
