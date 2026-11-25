/** What was seen: a number, or hits of which the last one, and not the one before, was enough. */
type Seen =
  | { readonly observed: number; readonly tolerance: number }
  | { readonly moreThan: number; readonly atMost: number };

/** One observed value against the engine's. */
export type Comparison = Seen & {
  readonly what: string;
  readonly computed: number | undefined;
  /** What to look at if they differ. */
  readonly explain?: () => string;
};

/** What floating point may be off by. */
const SLACK = 1e-9;

export const isMatch = (comparison: Comparison): boolean => {
  const { computed } = comparison;
  if (computed === undefined) return false;
  if ('observed' in comparison) {
    const { observed, tolerance } = comparison;
    return Math.abs(computed - observed) <= tolerance + SLACK;
  }
  return computed > comparison.moreThan && computed <= comparison.atMost + SLACK;
};

const shown = (value: number) => Number(value.toPrecision(8));

const describeSeen = (seen: Seen): string =>
  'observed' in seen
    ? String(seen.observed)
    : `more than ${shown(seen.moreThan)} and at most ${shown(seen.atMost)}`;

/** One line per value that differs, and what to look at. */
export const describeMismatch = (comparison: Comparison): string => {
  const { what, computed, explain } = comparison;
  const value = computed === undefined ? 'nothing' : shown(computed);
  const line = `${what}: reported ${describeSeen(comparison)}, computed ${value}`;
  return explain === undefined ? line : `${line}\n${explain()}`;
};
