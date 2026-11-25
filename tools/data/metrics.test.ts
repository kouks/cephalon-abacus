import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import { scenarioSchema } from '#data/schema/scenario.ts';
import { scenario } from '#data/testing/fixtures.ts';
import type { Warning } from '#engine/build/types.ts';
import { buildMetrics } from '#engine/metrics/buildMetrics.ts';

import { realLibrary as library } from './realAttack.ts';

const metricsOf = (weaponId: string, aim: object = { head: 0, body: 1 }) => {
  const build = { ...scenario.build, weaponId, modules: [] };
  const enemy = { ...scenario.enemy, id: 'neutral-dummy' };
  return buildMetrics(scenarioSchema.parse({ ...scenario, build, enemy, aim }), library);
};

const modeOf = (weaponId: string, attackId: string) =>
  must(
    metricsOf(weaponId).byAttack.find((entry) => entry.attackId === attackId),
    `No firing mode "${attackId}"`,
  );

/** A base crit multiplier as the game stores it. */
const stored = (multiplier: number) => (Math.round((multiplier * 4095) / 32) * 32) / 4095;

type Crit = readonly [chance: number, multiplier: number];

const mean = (white: number, [chance, multiplier]: Crit) =>
  white * (1 + chance * (stored(multiplier) - 1));

/** Per shot, shots per second, shots per magazine, reload, shots carried. */
type Expected = readonly [number, number, number, number, number];

/** Worked out by hand from the weapons' base stats: one case per trigger, and more. */
const CASES: readonly (readonly [trigger: string, weapon: string, attack: string, Expected])[] = [
  ['auto', 'braton', 'normal', [mean(24.75, [0.12, 1.6]), 8.75, 45, 2, 585]],
  ['autoSpool', 'soma-prime', 'normal', [mean(12, [0.3, 3]), 15, 200, 3, 1000]],
  ['duplex', 'tigris-prime', 'normal', [8 * mean(195, [0.1, 2]), 2, 2, 1.8, 122]],
  ['semi', 'lex', 'normal', [mean(130, [0.2, 2]), 1.083333, 6, 2.35, 216]],
  ['semi', 'nagantaka-prime', 'semi-auto', [mean(173, [0.25, 2.3]), 2.5, 11, 2.3, 551]],
  ['burst', 'burston', 'normal', [mean(30.9375, [0.06, 1.6]), 3 / 0.322, 45, 2, 585]],
  ['held', 'amprex', 'normal', [mean(22, [0.32, 2.2]), 12, 200, 2.6, 1600]],
  ['held', 'kuva-nukor', 'normal', [mean(33.6, [0.07, 5]), 10, 154, 2, 574]],
  ['active', 'penta', 'grenade-impact', [mean(425, [0.1, 2]), 1, 5, 2.5, 25]],
];

describe('unmodded metrics', () => {
  it.each(CASES)('%s: %s, %s', (...[, weapon, attack, expected]) => {
    const [perShot, rate, shots, reload, carried] = expected;
    const metrics = modeOf(weapon, attack);
    expect(metrics.perShot).toBeCloseTo(perShot, 6);
    expect(metrics.burstDps).toBeCloseTo(perShot * rate, 4);
    expect(metrics.sustainedDps).toBeCloseTo((perShot * rate * shots) / (shots + rate * reload), 4);
    expect(metrics.lifetimeDamage).toBeCloseTo(perShot * carried, 3);
  });

  it('charge: Paris reloads as it charges', () => {
    const { perShot, burstDps, sustainedDps, lifetimeDamage } = modeOf('paris', 'charged');
    expect(perShot).toBeCloseTo(mean(330, [0.3, 2]), 6);
    expect(burstDps).toBeCloseTo(perShot / (0.5 + 0.65), 6);
    expect(sustainedDps).toBeCloseTo(burstDps, 9);
    expect(lifetimeDamage).toBeCloseTo(perShot * 73, 6);
  });

  it('semi: Vectis Prime’s reload hides its last delay', () => {
    const { perShot, burstDps, sustainedDps } = modeOf('vectis-prime', 'normal');
    expect(perShot).toBeCloseTo(mean(350, [0.3, 2]), 6);
    expect(burstDps).toBeCloseTo(perShot * 2.666667, 6);
    expect(sustainedDps).toBeCloseTo(burstDps * (2 / (1 + 2.666667 * 0.85)), 6);
  });
});

const describeWarning = (warning: Warning) =>
  'what' in warning ? `${warning.attackId} ${warning.what}` : warning.code;

describe('every seed weapon', () => {
  it.each([...library.weapons.keys()])('%s has four metrics and a trace', (weaponId) => {
    const metrics = metricsOf(weaponId, { head: 0.5, body: 0.5 });
    const { perShot, burstDps, sustainedDps, lifetimeDamage, trace } = metrics;
    for (const value of [perShot, burstDps, sustainedDps, lifetimeDamage]) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(sustainedDps).toBeLessThanOrEqual(burstDps);
    expect(trace.length).toBeGreaterThanOrEqual(2);
  });

  it('says what its numbers leave out', () => {
    const lines = [...library.weapons.keys()].map((weaponId) => {
      const { warnings } = metricsOf(weaponId);
      return `${weaponId}: ${warnings.map(describeWarning).join(', ')}`;
    });
    expect(lines).toMatchInlineSnapshot(`
      [
        "braton: ",
        "soma-prime: normal spoolUp",
        "tigris-prime: ",
        "vectis: normal sniperCombo, normal zoom",
        "vectis-prime: normal sniperCombo, normal zoom",
        "paris: ",
        "burston: ",
        "amprex: normal beamRamp",
        "penta: ",
        "nagantaka-prime: ",
        "lex: ",
        "kuva-nukor: normal beamRamp",
      ]
    `);
  });
});

it('Penta’s explosion gets no headshot', () => {
  const grenade = 3 * 75 * (1 + 0.1 * (2 * stored(2) - 1));
  const { perShot } = metricsOf('penta', { head: 1, body: 0 });
  expect(perShot).toBeCloseTo(grenade + mean(350, [0.1, 2]), 6);
});
