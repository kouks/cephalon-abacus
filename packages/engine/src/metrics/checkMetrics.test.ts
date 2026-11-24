import { describe, expect, it } from 'vitest';

import { attackOf, BLAST, GRENADE, measureBuild } from '@/testing/metrics';

const BEAM = { rampStartPct: 0.3, rampTime: 0.6, decayDelay: 0.8, decayTime: 2 };
const FALLOFF = { start: 10, end: 20, minPct: 0.5 };

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

  it('falloff, beyond where it starts', () => {
    const at = (distance: number) => leftOut({ falloff: FALLOFF }, { scenario: { distance } });
    expect(at(10)).toEqual([]);
    expect(at(10.5)).toEqual([{ code: 'leftOut', attackId: 'normal', what: 'falloff' }]);
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
    const blast = { ...BLAST, falloff: FALLOFF };
    const warnings = warningsOf({ attacks: [GRENADE, blast], scenario: { distance: 15 } });
    expect(warnings).toEqual([{ code: 'leftOut', attackId: 'blast', what: 'falloff' }]);
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
