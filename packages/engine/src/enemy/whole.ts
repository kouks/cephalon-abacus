import type { Library } from '@abacus/data/load/library';
import type { ScaledStat, WholeRule } from '@abacus/data/schema/scaling';

/** How the game rounds a stat it keeps whole. */
export type Rounding = WholeRule['rounding'];

const isWholeRule = (rule: { readonly kind: string }): rule is WholeRule => rule.kind === 'whole';

/** How the game rounds a stat: shields to the nearest (T-46), armor down (T-48). */
export const roundingOf = (
  stat: ScaledStat,
  { scaling }: Pick<Library, 'scaling'>,
): Rounding | undefined =>
  [...scaling.values()].filter(isWholeRule).find(({ stats }) => stats.includes(stat))?.rounding;

/** A value as the game keeps it: as it is where the game keeps the fraction. */
export const toWhole = (value: number, rounding: Rounding | undefined): number => {
  if (rounding === undefined) return value;
  return rounding === 'down' ? Math.floor(value) : Math.round(value);
};
