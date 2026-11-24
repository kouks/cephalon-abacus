import type { Reference } from '@abacus/data/load/library';
import type { DamageType } from '@abacus/data/schema/damageType';

import { partOf, placeElements } from './placeElements';
import type { CombinedElements, ElementPart, ElementSource, FinalElement } from './types';

type DamageTypes = Reference['damageTypes'];

/** The secondary two primaries make. */
const secondaryOf = (first: DamageType, second: DamageType, types: DamageTypes) =>
  [...types.values()].find(
    ({ combinesFrom = [] }) =>
      first !== second &&
      [first, second].every((part) => combinesFrom.some((type) => type === part)),
  )?.id;

const finalOf = (element: DamageType, parts: readonly ElementPart[]): FinalElement => ({
  element,
  ratio: parts.reduce((sum, { ratio }) => sum + ratio, 0),
  parts,
});

/** Walks the placed primaries, pairing each with its neighbour. An odd one out stays itself. */
const pairUp = (parts: readonly ElementPart[], types: DamageTypes): readonly FinalElement[] => {
  const [first, second, ...rest] = parts;
  if (first === undefined) return [];
  if (second === undefined) return [finalOf(first.element, [first])];

  const secondary = secondaryOf(first.element, second.element, types);
  return secondary === undefined
    ? [finalOf(first.element, [first]), ...pairUp([second, ...rest], types)]
    : [finalOf(secondary, [first, second]), ...pairUp(rest, types)];
};

/** Adds an element that never combines to its like, or lets it stand alone. */
const addApart = (finals: readonly FinalElement[], part: ElementPart): readonly FinalElement[] => {
  const like = finals.find(({ element }) => element === part.element);
  if (like === undefined) return [...finals, finalOf(part.element, [part])];
  const joined = finalOf(like.element, [...like.parts, part]);
  return finals.map((final) => (final === like ? joined : final));
};

/** Ability elements never combine, and neither does what is no primary: an innate Blast. */
const combines = ({ origin, element }: ElementSource, types: DamageTypes) =>
  origin !== 'ability' && types.get(element)?.group === 'primary';

/** The elements an attack deals, from all its elemental bonuses (BIBLE §6). */
export const combineElements = (
  sources: readonly ElementSource[],
  types: DamageTypes,
): CombinedElements => {
  const primaries = sources.filter((source) => combines(source, types));
  const apart = sources
    .filter((source) => !combines(source, types))
    .map((source) => partOf(source.element, [{ ...source, placement: 'apart' }]));

  const explanation = apart.reduce(addApart, pairUp(placeElements(primaries), types));
  const ratios = new Map(explanation.map(({ element, ratio }) => [element, ratio]));
  return { ratios, explanation };
};
