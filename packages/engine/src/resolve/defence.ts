import type { DamageType } from '@abacus/data/schema/damageType';
import type { DamageTypeRule, Layer } from '@abacus/data/schema/damageTypeRule';

import type { EnemyStats } from '@/enemy/scaleEnemy';

/** What a hit meets on an enemy: the layer, and the armor on its health (BIBLE §10). */
export type Defence = {
  readonly layer: Layer;
  readonly armor: number;
  /** What each type does to each layer, from damageTypes.json. */
  readonly rules: ReadonlyMap<DamageType, DamageTypeRule>;
};

/** Armor at which the square root ends, at 90% (BIBLE §10). */
const MOST_ARMOR = 2700;

/** What armor leaves of a type's damage to health. Above 2,700: 300 ÷ (armor + 300). */
export const armorShare = (armor: number): number => {
  const net = Math.max(armor, 0);
  return net <= MOST_ARMOR ? 1 - 0.9 * Math.sqrt(net / MOST_ARMOR) : 300 / (net + 300);
};

/** The first layer an enemy has at its level, which a hit on a fresh one meets. */
export const firstLayer = (stats: EnemyStats | undefined): Layer => {
  if ((stats?.overguard.value ?? 0) > 0) return 'overguard';
  return (stats?.shield.value ?? 0) > 0 ? 'shield' : 'health';
};

/** Whether the enemy has the layer at its level. The neutral dummy has health alone. */
export const hasLayer = (layer: Layer, stats: EnemyStats | undefined): boolean =>
  layer === 'health' || (stats?.[layer].value ?? 0) > 0;

type Met = {
  /** The layer the scenario names. Absent: the first the enemy has. */
  readonly layer?: Layer | undefined;
  readonly stats: EnemyStats | undefined;
  readonly rules: Defence['rules'];
};

export const defenceOf = ({ layer, stats, rules }: Met): Defence => ({
  layer: layer ?? firstLayer(stats),
  armor: stats?.armor.value ?? 0,
  rules,
});
