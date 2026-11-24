import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import type { BodyPart } from '#data/schema/effect.ts';
import { scenarioSchema } from '#data/schema/scenario.ts';
import { scenario } from '#data/testing/fixtures.ts';
import type { Assumptions } from '#engine/assumptions.ts';
import { DEFAULT_ASSUMPTIONS } from '#engine/assumptions.ts';
import { collectEffects } from '#engine/build/collectEffects.ts';
import { selectionOf } from '#engine/build/selectEffects.ts';
import { totalBuckets } from '#engine/build/totalBuckets.ts';
import { hitCrit } from '#engine/resolve/crit/hitCrit.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();

type Hit = {
  readonly modules: readonly string[];
  readonly on?: 'body' | 'head';
  readonly assumptions?: Partial<Assumptions>;
};

const HEAD: readonly BodyPart[] = ['head', 'weakPoint'];

const crit = (weaponId: string, hit: Hit) => {
  const { modules, on = 'body', assumptions = {} } = hit;
  const weapon = must(library.weapons.get(weaponId), `No weapon "${weaponId}"`);
  const attack = must(weapon.attacks[0], `"${weaponId}" has no attack`);
  const build = {
    ...scenario.build,
    weaponId,
    modules: modules.map((moduleId) => ({ moduleId })),
  };
  const collected = collectEffects(scenarioSchema.parse({ ...scenario, build }), library);
  const bodyParts = new Set(on === 'head' ? HEAD : []);
  const selection = { ...selectionOf(weapon, attack), bodyParts };
  return hitCrit(attack, {
    totals: totalBuckets(collected, library, { selection }),
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...assumptions },
    headcrit: on === 'head' ? 2 : 1,
  });
};

describe('the seed weapons', () => {
  it('can all crit', () => {
    const chances = [...library.weapons.values()].map(
      ({ id }) => `${id} ${crit(id, { modules: [] }).chance.value}`,
    );
    expect(chances.filter((line) => line.endsWith(' 0'))).toEqual([]);
  });

  it('paris with Point Strike and Vital Sense averages 3.55x', () => {
    const { chance, expected } = crit('paris', { modules: ['point-strike', 'vital-sense'] });
    expect(chance.value).toBeCloseTo(0.75, 12);
    expect(expected).toBeCloseTo(3.55, 2);
  });

  it('get Acuity’s crit chance on weak points only', () => {
    const modules = ['primary-acuity'];
    expect(crit('vectis-prime', { modules }).chance.value).toBeCloseTo(0.3, 12);
    const onHead = crit('vectis-prime', { modules, on: 'head' }).chance.value;
    expect(onHead).toBeCloseTo(0.3 * (1 + 3.498), 12);
  });
});

/** Soma Prime's damage to a Charger: 12, quantized, with Serration and Slash at 1.5x. */
const BODY = 39.75;
const HEAD_DAMAGE = 3 * BODY;
/** And Galvanized Scope, which only makes orange crits possible. */
const T4_MODS = ['serration', 'vital-sense', 'critical-delay'];

const t4 = (on: 'body' | 'head', assumptions: Partial<Assumptions> = {}) => {
  const { multiplier } = crit('soma-prime', { modules: T4_MODS, on, assumptions });
  const damage = on === 'head' ? HEAD_DAMAGE : BODY;
  const colour = (tier: number) => Math.round(damage * (1 + tier * (multiplier.value - 1)));
  return [colour(0), colour(1), colour(2)];
};

describe('T-4, before its test', () => {
  it('expects these white, yellow and orange numbers', () => {
    expect(t4('body')).toEqual([40, 262, 485]);
    expect(t4('head')).toEqual([119, 1574, 3030]);
  });

  it('expects others on the head if only the base doubles', () => {
    expect(t4('head', { headcritScalesModded: false })).toEqual([119, 1145, 2171]);
  });
});
