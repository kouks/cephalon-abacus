import type { ScalingCurve, ScalingRule } from '@/schema/scaling';
import { DEFAULT_MISSION } from '@/schema/scaling';

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

/** The curves don't overlap, and the rules that everything else relies on are there. */
export const checkScaling = (located: readonly Located<ScalingRule>[]): readonly LibraryError[] => {
  const rules = located.map(({ item }) => item);
  const hasDefault = rules.some(({ kind, id }) => kind === 'mission' && id === DEFAULT_MISSION);
  const eximus = rules.filter(({ kind }) => kind === 'eximus');
  const missing = [
    ...(hasDefault ? [] : [`No mission "${DEFAULT_MISSION}"`]),
    ...(eximus.length === 1 ? [] : [`Expected one Eximus rule, found ${eximus.length}`]),
  ];
  return [
    ...checkCurves(located),
    ...missing.map((message) => errorAt(SCALING_FILE, ['items'], message)),
  ];
};
