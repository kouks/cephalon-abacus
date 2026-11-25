import type { ScalingCurve, ScalingRule } from '@/schema/scaling';

import { isCurve } from './findCurve';
import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import { SCALING_FILE } from './places';
import type { Located } from './readItems';

const overlap = (a: ScalingCurve, b: ScalingCurve) =>
  a.stat === b.stat &&
  (a.profiles === undefined ||
    b.profiles === undefined ||
    a.profiles.some((profile) => b.profiles?.includes(profile)));

/** A stat has one curve per profile. */
const checkCurves = (located: readonly Located<ScalingRule>[]): readonly LibraryError[] => {
  const curves = located.flatMap(({ item, file, index }) =>
    isCurve(item) ? [{ item, file, index }] : [],
  );
  return curves.flatMap(({ item, file, index }, at) => {
    const other = curves.slice(0, at).find((earlier) => overlap(earlier.item, item));
    if (other === undefined) return [];
    const message = `"${other.item.id}" is already a curve for this ${item.stat}`;
    return [errorAt(file, ['items', index, 'profiles'], message)];
  });
};

/** Rules there is one of. */
const SINGLE = [
  ['eximus', 'Eximus'],
  ['steelPath', 'Steel Path'],
] as const;

/** The curves don't overlap, and the rules that everything else relies on are there. */
export const checkScaling = (located: readonly Located<ScalingRule>[]): readonly LibraryError[] => {
  const countOf = (kind: ScalingRule['kind']) =>
    located.filter(({ item }) => item.kind === kind).length;
  const wrong = SINGLE.filter(([kind]) => countOf(kind) !== 1).map(([kind, name]) =>
    errorAt(SCALING_FILE, ['items'], `Expected one ${name} rule, found ${countOf(kind)}`),
  );
  return [...checkCurves(located), ...wrong];
};
