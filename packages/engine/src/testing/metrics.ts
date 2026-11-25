/** A build's metrics, against a 3x-headed neutral dummy. */
import { weapon } from '@abacus/data/testing/fixtures';

import type { Assumptions } from '@/assumptions';
import { buildMetrics } from '@/metrics/buildMetrics';

import { makeLibrary, makeScenario } from './build';

type Setup = {
  readonly modules?: readonly { readonly id: string }[];
  readonly attacks?: readonly object[];
  readonly weaponChange?: object;
  readonly build?: object;
  /** Changes to the rest of the scenario. */
  readonly scenario?: object;
  readonly assumptions?: Partial<Assumptions>;
};

const [baseAttack] = weapon.attacks;

/** An attack of the test rifle: 100 damage, 103.125 quantized, that never crits. */
export const attackOf = (id: string, change: object = {}) => ({
  ...baseAttack,
  id,
  name: id,
  flags: ['canHeadshot'],
  ...change,
});

export const GRENADE = attackOf('grenade', { damage: { impact: 75 }, linkedAttacks: ['blast'] });

export const AOE = { radius: 4, centerPct: 1, edgePct: 0.5, losRequired: false };

export const BLAST = attackOf('blast', {
  damage: { blast: 350 },
  shotType: 'aoe',
  aoe: AOE,
  ammoCost: 0,
  flags: ['isAoE'],
});

/** 8 shots/s, 45 rounds and 540 more, 2 s reload. */
export const measureBuild = (setup: Setup = {}) => {
  const { modules = [], attacks = [attackOf('normal')], weaponChange = {}, build = {} } = setup;
  const ids = modules.map(({ id }) => ({ moduleId: id }));
  const scenario = {
    ...makeScenario(ids, build),
    aim: { head: 0, body: 1 },
    enemy: { id: 'neutral-dummy', level: 1, steelPath: false, modifiers: [] },
    ...setup.scenario,
  };
  const library = makeLibrary(modules, { attacks, ...weaponChange });
  return buildMetrics(scenario, library, setup.assumptions);
};
