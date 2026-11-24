import { must } from '@abacus/data/assert';
import type { Library } from '@abacus/data/load/library';
import type { Module } from '@abacus/data/schema/module';
import type { ModuleInstance } from '@abacus/data/schema/scenario';

import type { Warning } from './types';

/** A module in use, and the share of its max-rank values it has at its rank. */
export type Equipped = { readonly module: Module; readonly share: number };

type Outcome = { readonly equipped?: Equipped; readonly warning?: Warning };

const shareAt = ({ rank }: Module, at: number) => {
  if (rank === undefined) return 1;
  if (rank.perRank === 'linear') return (at + 1) / (rank.max + 1);
  return must(rank.perRank[at], 'The schema requires a share per rank');
};

const findConflict = (module: Module, kept: readonly Equipped[]): Warning | undefined => {
  if (kept.some(({ module: other }) => other.id === module.id)) {
    return { code: 'duplicateModule', moduleId: module.id };
  }
  const { exclusiveGroup } = module;
  const rival = kept.find(
    ({ module: other }) => exclusiveGroup !== undefined && other.exclusiveGroup === exclusiveGroup,
  );
  if (rival === undefined) return undefined;
  return { code: 'exclusiveGroup', moduleId: module.id, keptId: rival.module.id };
};

const equipOne = (
  instance: ModuleInstance,
  modules: Library['modules'],
  kept: readonly Equipped[],
): Outcome => {
  const { moduleId } = instance;
  const module = modules.get(moduleId);
  if (module === undefined) return { warning: { code: 'unknownModule', moduleId } };

  const conflict = findConflict(module, kept);
  if (conflict !== undefined) return { warning: conflict };

  const max = module.rank?.max ?? 0;
  const rank = instance.rank ?? max;
  const equipped = { module, share: shareAt(module, Math.min(rank, max)) };
  return rank > max
    ? { equipped, warning: { code: 'rankAboveMax', moduleId, rank, max } }
    : { equipped };
};

/** The modules that take effect. Of two that exclude each other, the first one stays. */
export const equip = (instances: readonly ModuleInstance[], modules: Library['modules']) => {
  const equipped: Equipped[] = [];
  const warnings: Warning[] = [];
  for (const instance of instances) {
    const outcome = equipOne(instance, modules, equipped);
    if (outcome.equipped !== undefined) equipped.push(outcome.equipped);
    if (outcome.warning !== undefined) warnings.push(outcome.warning);
  }
  return { equipped, warnings };
};
