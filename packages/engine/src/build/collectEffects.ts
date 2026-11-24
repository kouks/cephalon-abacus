import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { Effect } from '@abacus/data/schema/effect';
import type { Scenario } from '@abacus/data/schema/scenario';

import { checkElements } from './composition/checkElements';
import { findConditionals } from './conditionals';
import { equip } from './equip';
import { applyLocks } from './locks';
import type { Collected, CollectedEffect, Source } from './types';

const collect = ({ id, name }: Source, effects: readonly Effect[], share: number) =>
  effects.map(({ value, ...effect }): CollectedEffect => {
    const isScaled = typeof value === 'object';
    return {
      ...effect,
      source: { id, name },
      value: (isScaled ? value.value : value) * share,
      times: isScaled ? value.times : [],
    };
  });

/**
 * The effects of everything in the scenario: the weapon's passives, the build's modules and the
 * mission's modifiers, in that order (BIBLE §5, §13). It scales them by rank, leaves out modules
 * that exclude each other and effects on locked buckets, and lists the build's conditionals.
 */
export const collectEffects = ({ build, enemy }: Scenario, library: Library): Collected => {
  const weapon = must(library.weapons.get(build.weaponId), `No weapon "${build.weaponId}"`);
  const { equipped, warnings } = equip([...build.modules, ...enemy.modifiers], library.modules);

  const all = [
    ...collect(weapon, weapon.innatePassives ?? [], 1),
    ...equipped.flatMap(({ module, share }) => collect(module, module.effects, share)),
  ];
  const free = applyLocks(
    all,
    equipped.map(({ module }) => module),
  );
  const switches = findConditionals(free.effects, build.conditionals);
  return {
    effects: free.effects,
    conditionals: switches.conditionals,
    warnings: [
      ...warnings,
      ...free.warnings,
      ...switches.warnings,
      ...checkElements(build, weapon, free.effects),
    ],
  };
};
