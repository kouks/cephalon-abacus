import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import { findBucket } from '#data/load/findBucket.ts';
import type { Effect } from '#data/schema/effect.ts';
import type { Module } from '#data/schema/module.ts';
import { scenarioSchema } from '#data/schema/scenario.ts';
import { scenario } from '#data/testing/fixtures.ts';
import { collectEffects } from '#engine/build/collectEffects.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();
const mods = [...library.modules.values()];

const describeEffect = ({ bucket, op, value }: Effect) => {
  if (typeof value === 'object') return `${bucket} ${JSON.stringify(value)}`;
  return op === 'ADD' ? `${bucket} +${value}` : `${bucket} ${Number((value * 100).toFixed(4))}%`;
};

const fitsOn = ({ slots, classes }: Module['compat']) =>
  `${slots.join(' ')}: ${classes?.[0] ?? 'any'}`;

const describeMod = ({ name, rank, compat, effects, exclusiveGroup, set, locks = [] }: Module) =>
  [
    `${name} r${rank?.max ?? '-'}`,
    fitsOn(compat),
    effects.map(describeEffect).join(', '),
    ...(exclusiveGroup === undefined ? [] : [`group ${exclusiveGroup}`]),
    ...(set === undefined ? [] : [`set ${set}`]),
    ...locks.map((bucket) => `locks ${bucket}`),
  ].join(' | ');

describe('the seed mods', () => {
  it('have the max-rank stats of the game', () => {
    expect(mods.map(describeMod)).toMatchInlineSnapshot(`
      [
        "Hornet Strike r10 | secondary: pistol | damage.base 220%",
        "Barrel Diffusion r5 | secondary: pistol | multishot 120% | group barrel-diffusion",
        "Lethal Torrent r5 | secondary: pistol | fireRate 60%, multishot 60%",
        "Pistol Gambit r5 | secondary: pistol | crit.chance 120% | group pistol-gambit",
        "Primed Pistol Gambit r10 | secondary: pistol | crit.chance 187% | group pistol-gambit",
        "Target Cracker r5 | secondary: pistol | crit.damage 60% | group target-cracker",
        "Primed Target Cracker r10 | secondary: pistol | crit.damage 110% | group target-cracker",
        "Sure Shot r5 | secondary: pistol | status.chance 90% | group sure-shot",
        "Perpetual Agony r5 | secondary: pistol | status.duration 90%",
        "Heated Charge r5 | secondary: pistol | damage.element.heat 90% | group heated-charge",
        "Primed Heated Charge r10 | secondary: pistol | damage.element.heat 165% | group heated-charge",
        "Deep Freeze r5 | secondary: pistol | damage.element.cold 90%",
        "Convulsion r5 | secondary: pistol | damage.element.electricity 90% | group convulsion",
        "Primed Convulsion r10 | secondary: pistol | damage.element.electricity 165% | group convulsion",
        "Pathogen Rounds r5 | secondary: pistol | damage.element.toxin 90%",
        "Magnetic Might r3 | secondary: pistol | damage.element.magnetic 60%, crit.damage 40%",
        "Concussion Rounds r5 | secondary: pistol | damage.ips.impact 90%",
        "No Return r5 | secondary: pistol | damage.ips.puncture 90%",
        "Razor Shot r5 | secondary: pistol | damage.ips.slash 90%",
        "Gunslinger r5 | secondary: pistol | fireRate 72%",
        "Expel Grineer r5 | secondary: pistol | damage.faction.grineer 30% | group expel-grineer",
        "Primed Expel Grineer r10 | secondary: pistol | damage.faction.grineer 55% | group expel-grineer",
        "Pistol Acuity r10 | secondary: pistol | weakPoint.damage +3.498, crit.chanceWeakPoint 349.8% | locks multishot",
        "Vigilante Armaments r5 | primary: any | multishot 60% | set vigilante",
        "Vigilante Fervor r5 | primary: any | fireRate 45% | set vigilante",
        "Vigilante Offense r5 | primary: any | punchThrough +1.5 | set vigilante",
        "Vigilante Supplies r5 | primary: any |  | set vigilante",
        "Serration r10 | primary: rifle | damage.base 165% | group serration",
        "Amalgam Serration r10 | primary: rifle | damage.base 155.1% | group serration",
        "Heavy Caliber r10 | primary: rifle | damage.base 165%",
        "Split Chamber r5 | primary: rifle | multishot 90% | group split-chamber",
        "Point Strike r5 | primary: rifle | crit.chance 150% | group point-strike",
        "Critical Delay r5 | primary: rifle | crit.chance 200%, fireRate -19.98% | group point-strike",
        "Galvanized Scope r10 | primary: rifle | crit.chance 120.01%, crit.chance 40% | group argon-scope",
        "Vital Sense r5 | primary: rifle | crit.damage 120%",
        "Rifle Aptitude r5 | primary: rifle | status.chance 90% | group rifle-aptitude",
        "Continuous Misery r3 | primary: rifle | status.duration 100%",
        "Hellfire r5 | primary: rifle | damage.element.heat 90%",
        "Cryo Rounds r5 | primary: rifle | damage.element.cold 90% | group cryo-rounds",
        "Primed Cryo Rounds r10 | primary: rifle | damage.element.cold 165% | group cryo-rounds",
        "Stormbringer r5 | primary: rifle | damage.element.electricity 90%",
        "Infected Clip r5 | primary: rifle | damage.element.toxin 90%",
        "Thermite Rounds r3 | primary: rifle | damage.element.heat 60%, status.chance 60%",
        "Crash Course r5 | primary: rifle | damage.ips.impact 120%",
        "Piercing Hit r5 | primary: rifle | damage.ips.puncture 90%",
        "Sawtooth Clip r5 | primary: rifle | damage.ips.slash 90%",
        "Speed Trigger r5 | primary: rifle | fireRate 60%",
        "Shred r5 | primary: rifle | fireRate 30%, punchThrough +1.2 | group shred",
        "Primed Shred r10 | primary: rifle | fireRate 55%, punchThrough +2.2 | group shred",
        "Vile Acceleration r5 | primary: rifle | fireRate 90%, damage.base -15%",
        "Bane of Grineer r5 | primary: rifle | damage.faction.grineer 30% | group bane-of-grineer",
        "Primed Bane of Grineer r10 | primary: rifle | damage.faction.grineer 55% | group bane-of-grineer",
        "Bane of Corpus r5 | primary: rifle | damage.faction.corpus 30% | group bane-of-corpus",
        "Primed Bane of Corpus r10 | primary: rifle | damage.faction.corpus 55% | group bane-of-corpus",
        "Primary Acuity r10 | primary: rifle | weakPoint.damage +3.498, crit.chanceWeakPoint 349.8% | locks multishot",
        "Fast Hands r5 | primary: rifle | reload 30% | group fast-hands",
        "Magazine Warp r5 | primary: rifle | magazine 30% | group magazine-warp",
        "Tainted Mag r10 | primary: rifle | magazine 66%, reload -33%",
        "Depleted Reload r5 | primary: sniper | magazine -60%, reload 48%",
        "Point Blank r5 | primary: shotgun | damage.base 90% | group point-blank",
        "Primed Point Blank r10 | primary: shotgun | damage.base 165% | group point-blank",
        "Hell's Chamber r5 | primary: shotgun | multishot 120% | group hells-chamber",
        "Blunderbuss r5 | primary: shotgun | crit.chance 90% | group blunderbuss",
        "Ravage r5 | primary: shotgun | crit.damage 60% | group ravage",
        "Primed Ravage r10 | primary: shotgun | crit.damage 110% | group ravage",
        "Shotgun Barrage r5 | primary: shotgun | fireRate 90% | group shotgun-barrage",
        "Shotgun Savvy r5 | primary: shotgun | status.chance 90% | group shotgun-savvy",
        "Lingering Torment r5 | primary: shotgun | status.duration 90%",
        "Incendiary Coat r5 | primary: shotgun | damage.element.heat 90%",
        "Chilling Grasp r5 | primary: shotgun | damage.element.cold 90% | group chilling-grasp",
        "Primed Chilling Grasp r10 | primary: shotgun | damage.element.cold 165% | group chilling-grasp",
        "Charged Shell r5 | primary: shotgun | damage.element.electricity 90% | group charged-shell",
        "Primed Charged Shell r10 | primary: shotgun | damage.element.electricity 165% | group charged-shell",
        "Contagious Spread r5 | primary: shotgun | damage.element.toxin 90%",
        "Disruptor r5 | primary: shotgun | damage.ips.impact 90%",
        "Flechette r5 | primary: shotgun | damage.ips.puncture 90%",
        "Shredder r5 | primary: shotgun | damage.ips.slash 90%",
        "Cleanse Grineer r5 | primary: shotgun | damage.faction.grineer 30% | group cleanse-grineer",
        "Primed Cleanse Grineer r10 | primary: shotgun | damage.faction.grineer 55% | group cleanse-grineer",
      ]
    `);
  });

  it('write into buckets that exist', () => {
    const buckets = mods.flatMap(({ effects }) => effects);
    const unknown = buckets.filter(({ bucket }) => findBucket(bucket, library) === undefined);
    expect(unknown).toEqual([]);
  });

  it('fit one kind of weapon each', () => {
    const compat = mods.map(({ compat: { slots, classes = ['any'] } }) =>
      [...slots, ':', ...classes].join(' '),
    );
    expect([...new Set(compat)].sort()).toEqual([
      'primary : any',
      'primary : rifle',
      'primary : rifle bow crossbow launcher sniper speargun',
      'primary : shotgun',
      'primary : sniper',
      'secondary : pistol dual-pistol shotgun-sidearm dual-shotgun thrown crossbow',
    ]);
  });

  it('come from the official wiki, checked against one version', () => {
    for (const { source } of mods) expect(source).toMatch(/^https:\/\/wiki\.warframe\.com\/w\//);
    expect(new Set(mods.map(({ gameVersion }) => gameVersion))).toEqual(new Set(['44.1.4.1']));
  });
});

/** A Braton with these modules, through the engine. */
const collect = (modules: readonly object[]) => {
  const build = { ...scenario.build, weaponId: 'braton', modules };
  return collectEffects(scenarioSchema.parse({ ...scenario, build }), library);
};

const valueAt = (moduleId: string, rank: number, bucket: string) => {
  const effect = collect([{ moduleId, rank }]).effects.find((entry) => entry.bucket === bucket);
  return must(effect, `${moduleId} has no effect on ${bucket}`).value;
};

/** As the game rounds: halves go up, and floating point must not decide a half. */
const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits + 1e-9) / 10 ** digits;

const warningsOf = (...ids: readonly string[]) =>
  collect(ids.map((moduleId) => ({ moduleId }))).warnings;

describe('ranks, as the game displays them', () => {
  it.each([
    ['serration', 0, 'damage.base', 15, 0],
    ['serration', 3, 'damage.base', 60, 0],
    ['serration', 10, 'damage.base', 165, 0],
    ['amalgam-serration', 4, 'damage.base', 71, 0],
    ['amalgam-serration', 9, 'damage.base', 141, 0],
    ['amalgam-serration', 10, 'damage.base', 155, 0],
    ['hornet-strike', 5, 'damage.base', 120, 0],
    ['primed-point-blank', 0, 'damage.base', 15, 0],
    ['split-chamber', 2, 'multishot', 45, 0],
    ['point-strike', 2, 'crit.chance', 75, 0],
    ['critical-delay', 1, 'crit.chance', 66.7, 1],
    ['critical-delay', 0, 'fireRate', -3.3, 1],
    ['critical-delay', 4, 'fireRate', -16.6, 1],
    ['critical-delay', 5, 'fireRate', -20, 1],
    ['primed-pistol-gambit', 4, 'crit.chance', 85, 0],
    ['galvanized-scope', 0, 'crit.chance', 10.9, 1],
    ['galvanized-scope', 4, 'crit.chance', 54.6, 1],
    ['galvanized-scope', 10, 'crit.chance', 120, 1],
    ['tainted-mag', 4, 'magazine', 30, 0],
    ['tainted-mag', 10, 'reload', -33, 0],
    ['depleted-reload', 2, 'magazine', -30, 0],
    ['depleted-reload', 5, 'reload', 48, 0],
    ['primed-bane-of-grineer', 0, 'damage.faction.grineer', 5, 0],
    ['primed-bane-of-grineer', 10, 'damage.faction.grineer', 55, 0],
    ['primary-acuity', 0, 'weakPoint.damage', 32, 0],
    ['primary-acuity', 0, 'crit.chanceWeakPoint', 32, 0],
    ['primary-acuity', 7, 'weakPoint.damage', 254, 0],
    ['primary-acuity', 10, 'weakPoint.damage', 350, 0],
    ['pistol-acuity', 7, 'crit.chanceWeakPoint', 254, 0],
    ['magnetic-might', 1, 'damage.element.magnetic', 30, 0],
    ['thermite-rounds', 2, 'status.chance', 45, 0],
  ])('%s at rank %i: %s %d%', (...[id, rank, bucket, displayed, digits]) => {
    expect(round(valueAt(id, rank, bucket) * 100, digits)).toBe(displayed);
  });

  it('flat bonuses scale too: Vigilante Offense at rank 2 shows 0.8 m', () => {
    expect(valueAt('vigilante-offense', 2, 'punchThrough')).toBeCloseTo(0.75, 12);
  });
});

describe('exclusive groups', () => {
  it('keep variants of one mod apart', () => {
    expect(warningsOf('cryo-rounds', 'primed-cryo-rounds')).toEqual([
      { code: 'exclusiveGroup', moduleId: 'primed-cryo-rounds', keptId: 'cryo-rounds' },
    ]);
    expect(warningsOf('point-strike', 'critical-delay')).toHaveLength(1);
  });

  it('let the rest combine: Serration, Heavy Caliber, Split Chamber and Vigilante Armaments', () => {
    expect(
      warningsOf('serration', 'heavy-caliber', 'split-chamber', 'vigilante-armaments'),
    ).toEqual([]);
  });

  it('lock multishot with Acuity', () => {
    expect(warningsOf('primary-acuity', 'split-chamber', 'vigilante-armaments')).toEqual([
      {
        code: 'lockedBucket',
        sourceId: 'split-chamber',
        bucket: 'multishot',
        lockedBy: 'primary-acuity',
      },
      {
        code: 'lockedBucket',
        sourceId: 'vigilante-armaments',
        bucket: 'multishot',
        lockedBy: 'primary-acuity',
      },
    ]);
  });
});
