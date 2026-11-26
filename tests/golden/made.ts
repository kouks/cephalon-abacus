import type { Depleted, GoldenFixture, Layered } from '@abacus/data/schema/goldenFixture';
import { goldenFixtureSchema } from '@abacus/data/schema/goldenFixture';
import type { Scenario } from '@abacus/data/schema/scenario';
import { scenarioSchema } from '@abacus/data/schema/scenario';
import { attack, enemy, scenario, weapon } from '@abacus/data/testing/fixtures';

import type { Run } from './replay';
import { runOf } from './runOf';

/** The test rifle's hits on a Techrot, which is neutral to them: 103.125 white, 206.3 yellow. */
export const WHITE = 103.125;
export const YELLOW = WHITE * ((256 * 32) / 4095);

type Layers = {
  readonly overguard?: number;
  readonly shield?: number;
  readonly health?: number;
  /** The rifle's damage by type, if not its own. */
  readonly damage?: Readonly<Record<string, number>>;
};

/** A made-up fixture: the test rifle on a level 1 enemy with these layers, which grow no further. */
const fixtureOf = ({ overguard = 0, shield = 0, health = 1000, damage }: Layers): GoldenFixture =>
  goldenFixtureSchema.parse({
    id: 'T-1',
    question: 'Made up',
    bible: '§10',
    gameVersion: '44.1.4.1',
    reports: [{ on: '2026-11-26', words: 'made up' }],
    tolerance: { hits: 0.5 },
    weapons: [{ ...weapon, attacks: [{ ...attack, ...(damage === undefined ? {} : { damage }) }] }],
    enemies: [
      {
        ...enemy,
        faction: 'techrot',
        scalingProfile: 'techrot',
        baseHealth: health,
        baseShield: shield,
        baseOverguard: overguard,
      },
    ],
    cases: [{ name: 'made up', scenario, observed: { hits: { white: 1 } } }],
  });

const SCENARIO: Scenario = scenarioSchema.parse({
  ...scenario,
  build: { ...scenario.build, weaponId: 'test-rifle', modules: [] },
  enemy: { id: 'test-enemy', level: 1, steelPath: false, modifiers: [] },
  aim: { head: 0, body: 1 },
});

/** The test rifle's run on such an enemy, or on the neutral dummy. */
export const runOn = (layers: Layers | 'dummy'): Run =>
  layers === 'dummy'
    ? runOf(fixtureOf({}), { ...SCENARIO, enemy: { ...SCENARIO.enemy, id: 'neutral-dummy' } })
    : runOf(fixtureOf(layers), SCENARIO);

export type { Depleted, Layered };
