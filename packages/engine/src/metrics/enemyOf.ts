import type { Library } from '@abacus/data/load/library';
import type { Scenario } from '@abacus/data/schema/scenario';

import { enemyStats } from '@/enemy/scaleEnemy';
import { roundingOf } from '@/enemy/whole';
import { defenceOf } from '@/resolve/defence';
import { findTarget } from '@/resolve/target';

/** The enemy as the scenario has it: who it is, its stats at its level, and what a hit meets. */
export const enemyOf = (enemy: Scenario['enemy'], library: Library) => {
  const target = findTarget(enemy.id, library);
  const stats = enemyStats(enemy, library);
  const { layer, left } = enemy;
  const armorRounding = roundingOf('armor', library);
  const defence = defenceOf({ layer, left, stats, rules: library.damageTypes, armorRounding });
  return { target, stats, defence };
};
