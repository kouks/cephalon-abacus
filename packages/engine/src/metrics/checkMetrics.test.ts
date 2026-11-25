import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { AOE, attackOf, BLAST, GRENADE, measureBuild } from '@/testing/metrics';

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
