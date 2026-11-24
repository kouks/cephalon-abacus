import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { Scenario } from '@abacus/data/schema/scenario';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Assumptions } from '@/assumptions';
import { DEFAULT_ASSUMPTIONS } from '@/assumptions';

import { collectEffects } from './collectEffects';
import type { Collected } from './types';

/** A scenario's weapon with everything on it, read from the library once. */
export type Loadout = {
  readonly build: Scenario['build'];
  readonly library: Library;
  readonly weapon: Weapon;
  readonly collected: Collected;
  readonly assumptions: Assumptions;
};

export const makeLoadout = (
  scenario: Scenario,
  library: Library,
  assumptions: Partial<Assumptions> = {},
): Loadout => {
  const { build } = scenario;
  return {
    build,
    library,
    weapon: must(library.weapons.get(build.weaponId), `No weapon "${build.weaponId}"`),
    collected: collectEffects(scenario, library),
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...assumptions },
  };
};
