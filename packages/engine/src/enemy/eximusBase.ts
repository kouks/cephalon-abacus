import type { Enemy } from '@abacus/data/schema/enemy';
import type { EximusRule } from '@abacus/data/schema/scaling';

type Points = EximusRule['multiplier'];

/** On the straight line between the two points around a level, or at the nearest one. */
const multiplierAt = (points: Points, level: number): number => {
  const after = points.findIndex((point) => point.level >= level);
  const next = points[after];
  const previous = points[after - 1];
  if (next === undefined) return points.at(-1)?.value ?? 1;
  if (previous === undefined) return next.value;
  const share = (level - previous.level) / (next.level - previous.level);
  return previous.value + (next.value - previous.value) * share;
};

type Base = { readonly health: number; readonly shield: number };

/** What an Eximus unit's health and shields start from, before they grow (BIBLE §10). */
export const eximusBase = (
  { baseHealth, baseShield, baseArmor }: Enemy,
  level: number,
  { multiplier, least, addedHealth, healthShare }: EximusRule,
): Base => {
  const rate = multiplierAt(multiplier, level);
  const isProtected = baseShield > 0 || baseArmor > 0;
  const share = isProtected ? healthShare.protected : healthShare.bare;
  return {
    health: Math.max(baseHealth * least, share * (baseHealth + addedHealth) * rate),
    shield: baseShield * Math.max(least, rate),
  };
};
