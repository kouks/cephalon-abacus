import { must } from '@abacus/data/assert';
import type { Layer } from '@abacus/data/schema/damageTypeRule';

/**
 * What one hit did to one layer: what the layer lost, and the number the game shows for it, unless
 * the layer shows none of its own (BIBLE §15).
 */
export type Dealt = { readonly layer: Layer; readonly shown?: number; readonly applied: number };

/** One layer a hit met, in order. */
export type Step = {
  readonly layer: Layer;
  readonly damage: number;
  readonly applied: number;
  /** What of the hit went on, as this layer took it. */
  readonly wentOn: number;
  /** What of the damage came through the break of each layer before. */
  readonly throughBreaks: ReadonlyMap<Layer, number>;
};

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** What of the hit a layer doesn't show: what went on, as it took it or as the later layers show it. */
const furtherOf = (steps: readonly Step[], index: number, isShownInOwnTerms: boolean) => {
  const { layer, wentOn } = must(steps[index], 'A step of the hit');
  if (isShownInOwnTerms) return wentOn;
  return sum(steps.slice(index + 1).map(({ throughBreaks }) => throughBreaks.get(layer) ?? 0));
};

/** A layer's own number before rounding: the hit, less what went on if it broke. */
const amountOf = (steps: readonly Step[], index: number, isShownInOwnTerms: boolean) =>
  must(steps[index], 'A step of the hit').damage - furtherOf(steps, index, isShownInOwnTerms);

/** Each layer's own number: the rounded hit less the rounded rest, if it broke (T-38). */
const eachOf = (steps: readonly Step[], isShownInOwnTerms: boolean): readonly Dealt[] =>
  steps.map(({ layer, damage, applied }, index) => {
    const further = furtherOf(steps, index, isShownInOwnTerms);
    return { layer, shown: Math.round(damage) - Math.round(further), applied };
  });

/**
 * Overguard shows one number for all a hit does: what it took, and what the layers after it take
 * if the hit breaks it, added up and then rounded. They show none of their own (T-44).
 */
const mergedOf = (steps: readonly Step[], isShownInOwnTerms: boolean): readonly Dealt[] => {
  const [overguard, ...after] = steps;
  const { layer, applied } = must(overguard, 'Overguard was met');
  const amounts = after.map((_, index) => amountOf(steps, index + 1, isShownInOwnTerms));
  const shown = Math.round(applied + sum(amounts));
  return [
    { layer, shown, applied },
    ...after.map((step) => ({ layer: step.layer, applied: step.applied })),
  ];
};

/** What each layer a hit met shows and loses (BIBLE §15). */
export const dealtOf = (steps: readonly Step[], isShownInOwnTerms: boolean): readonly Dealt[] => {
  const dealt =
    steps[0]?.layer === 'overguard'
      ? mergedOf(steps, isShownInOwnTerms)
      : eachOf(steps, isShownInOwnTerms);
  return dealt.filter(({ applied }) => applied > 0);
};
