import { must } from '#data/assert.ts';
import type { BodyPart } from '#data/schema/effect.ts';
import type { ModuleInstance } from '#data/schema/scenario.ts';
import { scenarioSchema } from '#data/schema/scenario.ts';
import { scenario } from '#data/testing/fixtures.ts';
import type { Assumptions } from '#engine/assumptions.ts';
import { buildAttack } from '#engine/build/buildAttack.ts';
import { makeLoadout } from '#engine/build/loadout.ts';

import { loadRealLibrary } from './loadRealLibrary.ts';

export const realLibrary = loadRealLibrary();

type With = {
  /** At max rank, unless an instance says otherwise. */
  readonly modules?: readonly (string | ModuleInstance)[];
  readonly bodyParts?: readonly BodyPart[];
  readonly assumptions?: Partial<Assumptions>;
};

/** A weapon of the library with real mods on it. */
export const realAttack = (weaponId: string, attackId: string, change: With = {}) => {
  const { modules = [], bodyParts = [], assumptions = {} } = change;
  const equipped = modules.map((entry) =>
    typeof entry === 'string' ? { moduleId: entry } : entry,
  );
  const build = { ...scenario.build, weaponId, modules: equipped };
  const loadout = makeLoadout(
    scenarioSchema.parse({ ...scenario, build }),
    realLibrary,
    assumptions,
  );
  const attack = must(
    loadout.weapon.attacks.find(({ id }) => id === attackId),
    `No attack "${attackId}"`,
  );
  return buildAttack(loadout, attack, { bodyParts });
};
