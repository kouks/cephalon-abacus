import type { DamageType } from '@abacus/data/schema/damageType';
import type { DamageTypeRule, Layer } from '@abacus/data/schema/damageTypeRule';

import type { EnemyStats } from '@/enemy/scaleEnemy';

import type { LayersLeft } from './applyHit';

/** What a hit meets on an enemy: the layer, and the armor on its health (BIBLE §10). */
export type Defence = {
  readonly layer: Layer;
  /** Within its limits: at least 200 and at most 2,700. */
  readonly armor: number;
  /** What it would be over 2,700, where the cap lowered it. */
  readonly uncappedArmor?: number;
  /** What the enemy has left of each layer. Those before the layer the hit meets are gone. */
  readonly left: LayersLeft;
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
  /** The layer the scenario names. Absent: the first the enemy has left. */
  readonly layer?: Layer | undefined;
  /** What the scenario says the enemy has left. Absent: all of it. */
  readonly left?: Partial<LayersLeft> | undefined;
  readonly stats: EnemyStats | undefined;
  readonly rules: Defence['rules'];
};

/** All of each layer, and endless health on the neutral dummy, which has no stats. */
const fullOf = (stats: EnemyStats | undefined): LayersLeft => ({
  overguard: stats?.overguard.value ?? 0,
  shield: stats?.shield.value ?? 0,
  health: stats?.health.value ?? Number.POSITIVE_INFINITY,
});

const ORDER: readonly Layer[] = ['overguard', 'shield', 'health'];

export const defenceOf = ({ layer, left = {}, stats, rules }: Met): Defence => {
  const full = { ...fullOf(stats), ...left };
  const met = layer ?? ORDER.find((entry) => entry !== 'health' && full[entry] > 0) ?? 'health';
  const before = ORDER.slice(0, ORDER.indexOf(met));
  const gone = Object.fromEntries(before.map((entry) => [entry, 0]));
  const uncapped = stats?.armor.uncapped;
  const defence = { layer: met, armor: stats?.armor.value ?? 0, left: { ...full, ...gone }, rules };
  return uncapped === undefined ? defence : { ...defence, uncappedArmor: uncapped };
};
