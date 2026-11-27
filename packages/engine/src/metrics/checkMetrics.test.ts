import { describe, expect, it } from 'vitest';

import { enemy } from '@abacus/data/testing/fixtures';

import { add, makeLibrary, mod } from '@/testing/build';
import { AOE, attackOf, BLAST, GRENADE, measureBuild } from '@/testing/metrics';

import { enemyStatuses } from './enemyStatuses';

const BEAM = { rampStartPct: 0.3, rampTime: 0.6, decayDelay: 0.8, decayTime: 2 };

const warningsOf = (setup: Parameters<typeof measureBuild>[0]) => measureBuild(setup).warnings;

const leftOut = (attack: object, setup: Parameters<typeof measureBuild>[0] = {}) =>
  warningsOf({ attacks: [attackOf('normal', attack)], ...setup });

describe('the metrics say that they leave out', () => {
  it.each([
    ['beamRamp', { trigger: 'held', shotType: 'continuous', beam: BEAM }],
    ['spoolUp', { trigger: 'autoSpool', spool: { shotsToMax: 4 } }],
  ])('%s', (what, attack) => {
    expect(leftOut(attack)).toEqual([{ code: 'leftOut', attackId: 'normal', what }]);
  });

  it('what a sniper rifle adds', () => {
    const weaponChange = {
      sniperCombo: { minHits: 5, reset: 2 },
      zoomLevels: [{ zoom: 2, effects: [] }],
    };
    const whats = leftOut({}, { weaponChange }).map((warning) => 'what' in warning && warning.what);
    expect(whats).toEqual(['sniperCombo', 'zoom']);
  });

  it('what an attack that is set off has', () => {
    const blast = { ...BLAST, trigger: 'autoSpool', spool: { shotsToMax: 4 } };
    const warnings = warningsOf({ attacks: [GRENADE, blast] });
    expect(warnings).toEqual([{ code: 'leftOut', attackId: 'blast', what: 'spoolUp' }]);
  });
});

describe('the metrics warn', () => {
  it('of a firing mode the weapon lacks, and use the first', () => {
    const { warnings, attackId } = measureBuild({ build: { attackId: 'alternate' } });
    expect(warnings).toEqual([{ code: 'unknownAttack', attackId: 'alternate' }]);
    expect(attackId).toBe('normal');
  });

  it('of an attack that only another sets off', () => {
    const warnings = warningsOf({ attacks: [GRENADE, BLAST], build: { attackId: 'blast' } });
    expect(warnings).toEqual([{ code: 'unknownAttack', attackId: 'blast' }]);
  });

  it('of a part the target lacks, if anything is aimed at it', () => {
    const aimed = (aim: object) => warningsOf({ scenario: { aim } });
    expect(aimed({ head: 1, body: 0, weakPoint: 'tail' })).toEqual([
      { code: 'unknownPart', part: 'tail' },
    ]);
    expect(aimed({ head: 0, body: 1, weakPoint: 'tail' })).toEqual([]);
    expect(aimed({ head: 1, body: 0 })).toEqual([]);
  });

  it('of the build’s own problems', () => {
    const build = { elementOrder: ['hellfire'] };
    expect(warningsOf({ build })).toEqual([{ code: 'unusedElement', sourceId: 'hellfire' }]);
  });
});

describe('the metrics warn of an attack that doesn’t reach', () => {
  const at = (distance: number, attacks: readonly object[], modules?: readonly { id: string }[]) =>
    warningsOf({ attacks, scenario: { distance }, ...(modules === undefined ? {} : { modules }) });

  const beam = attackOf('beam', { range: 18 });

  it('and say how far it goes', () => {
    expect(at(18, [beam])).toEqual([]);
    expect(at(19, [beam])).toEqual([
      { code: 'outOfRange', attackId: 'beam', range: 18, distance: 19 },
    ]);
  });

  it('with the range that mods give it', () => {
    const modules = [mod('sinister-reach', [add('range', 12, { op: 'ADD' })])];
    expect(at(30, [beam], modules)).toEqual([]);
    expect(at(31, [beam], modules)).toMatchObject([{ range: 30, distance: 31 }]);
  });

  it('once for each firing mode, and not for what it sets off', () => {
    const rifle = attackOf('rifle', { range: 300 });
    const warnings = at(20, [rifle, beam, { ...GRENADE, range: 10 }, BLAST]);
    expect(warnings.map((warning) => 'attackId' in warning && warning.attackId)).toEqual([
      'beam',
      'grenade',
    ]);
  });
});

describe('the metrics warn of an attack that lands beside the target', () => {
  const missBy = (metres: number, ...attacks: readonly object[]) =>
    warningsOf({ attacks, scenario: { aim: { head: 0, body: 1, missBy: metres } } });

  it('and sets off nothing', () => {
    const rifle = attackOf('rifle');
    expect(missBy(0, rifle)).toEqual([]);
    expect(missBy(0.5, rifle)).toEqual([
      { code: 'missesTarget', attackId: 'rifle', missBy: 0.5, radius: 0 },
    ]);
  });

  it('or whose widest explosion is too small', () => {
    const cluster = { ...BLAST, id: 'cluster', aoe: { ...AOE, radius: 2 } };
    const grenade = { ...GRENADE, linkedAttacks: ['cluster', 'blast'] };
    expect(missBy(4, grenade, cluster, BLAST)).toEqual([]);
    expect(missBy(4.5, grenade, cluster, BLAST)).toEqual([
      { code: 'missesTarget', attackId: 'grenade', missBy: 4.5, radius: 4 },
    ]);
  });

  it('with the radius that mods give it', () => {
    const modules = [mod('firestorm', [add('aoeRadius', 0.24)])];
    const aim = { head: 0, body: 1, missBy: 4.5 };
    const attacks = [GRENADE, BLAST];
    expect(warningsOf({ attacks, modules, scenario: { aim } })).toEqual([]);
  });
});

describe('the metrics warn of what an enemy takes off damage', () => {
  const met = (change: object) =>
    warningsOf({
      enemies: [{ ...enemy, ...change }],
      scenario: { enemy: { id: 'test-enemy', level: 1, steelPath: false, modifiers: [] } },
    });

  it('but not of its armor, which the hit counts', () => {
    expect(met({})).toEqual([]);
    expect(met({ baseArmor: 5 })).toEqual([]);
  });

  it('and of attenuation, which a boss may not have', () => {
    expect(met({ flags: ['boss'] })).toEqual([]);
    expect(met({ flags: ['boss', 'hasAttenuation'] })).toEqual([
      { code: 'enemyLeftOut', enemyId: 'test-enemy', what: 'attenuation' },
    ]);
  });
});

describe('the metrics warn of a layer the enemy lacks', () => {
  const meeting = (layer: string, change: object = {}) =>
    warningsOf({
      enemies: [{ ...enemy, ...change }],
      scenario: { enemy: { id: 'test-enemy', level: 1, steelPath: false, modifiers: [], layer } },
    });

  it('and hits it anyway', () => {
    expect(meeting('health')).toEqual([]);
    expect(meeting('shield')).toEqual([{ code: 'missingLayer', layer: 'shield' }]);
    expect(meeting('shield', { baseShield: 50 })).toEqual([]);
  });

  it('of the neutral dummy too, which has health alone', () => {
    const dummy = (layer: string) =>
      warningsOf({
        scenario: {
          enemy: { id: 'neutral-dummy', level: 1, steelPath: false, modifiers: [], layer },
        },
      });
    expect(dummy('health')).toEqual([]);
    expect(dummy('overguard')).toEqual([{ code: 'missingLayer', layer: 'overguard' }]);
  });
});

describe('the metrics warn of statuses on the enemy', () => {
  const carrying = (statuses: object, change: object = {}) =>
    measureBuild({
      enemies: [{ ...enemy, ...change }],
      scenario: {
        enemy: { id: 'test-enemy', level: 1, steelPath: false, modifiers: [], statuses },
      },
    });

  it('that the library lacks, and leave them out', () => {
    const { warnings, perShot } = carrying({ 'brand-new': 2 });
    expect(warnings).toEqual([{ code: 'unknownStatus', status: 'brand-new' }]);
    expect(perShot).toBeCloseTo(carrying({}).perShot, 9);
  });

  it('above the most a status stacks to, and count the most', () => {
    const { warnings, perShot } = carrying({ virus: 12 });
    expect(warnings).toEqual([{ code: 'statusAboveMost', status: 'virus', stacks: 12, most: 10 }]);
    expect(perShot).toBeCloseTo(carrying({ virus: 10 }).perShot, 9);
    expect(carrying({ virus: 10 }).warnings).toEqual([]);
  });

  it('above the enemy’s own cap on it', () => {
    const capped = carrying({ virus: 5 }, { statusCaps: { viral: 3 } });
    expect(capped.warnings).toEqual([
      { code: 'statusAboveMost', status: 'virus', stacks: 5, most: 3 },
    ]);
    expect(capped.perShot).toBeCloseTo(carrying({ virus: 3 }).perShot, 9);
  });

  it('above Cold’s 4 while the enemy has Overguard left (the wiki’s Cold page)', () => {
    const library = makeLibrary([]);
    const cold = {
      id: 'neutral-dummy',
      level: 1,
      steelPath: false,
      modifiers: [],
      statuses: { freeze: 6 },
    };
    const left = (overguard: number) => ({ left: { overguard, shield: 0, health: 100 } });
    expect(enemyStatuses(cold, library, left(50)).warnings).toEqual([
      { code: 'statusAboveMost', status: 'freeze', stacks: 6, most: 4 },
    ]);
    expect(enemyStatuses(cold, library, left(0)).warnings).toEqual([]);
  });
});
