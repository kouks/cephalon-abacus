/** Made-up scaling rules: round numbers, and no part of the real library. */

import { item } from './item';

/** 1 + 0.01 levels², then 1 + 10 √levels, from 70 to 80 levels. */
export const curve = {
  ...item('grineer-health'),
  kind: 'curve',
  stat: 'health',
  profiles: ['grineer'],
  above: 'base',
  low: { coefficient: 0.01, exponent: 2 },
  high: { coefficient: 10, exponent: 0.5 },
  blend: { from: 70, to: 80 },
};

export const armorCurve = { ...curve, id: 'grineer-armor', stat: 'armor' };

export const shieldCurve = { ...curve, id: 'grineer-shield', stat: 'shield' };

export const eximus = {
  ...item('eximus'),
  kind: 'eximus',
  multiplier: [
    { level: 15, value: 1 },
    { level: 25, value: 2 },
  ],
  least: 1.1,
  addedHealth: 900,
  healthShare: { protected: 0.25, bare: 0.375 },
};

export const steelPath = { ...item('steel-path'), kind: 'steelPath', health: 2.5, shield: 2 };

/** The game keeps shields whole, to the nearest (T-46). */
export const whole = {
  ...item('whole-stats'),
  kind: 'whole',
  stats: ['shield'],
  rounding: 'nearest',
};

/** The game keeps armor whole, rounded down (T-48). */
export const wholeArmor = {
  ...item('whole-armor'),
  kind: 'whole',
  stats: ['armor'],
  rounding: 'down',
};
