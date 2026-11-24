import type { DamageType } from '@abacus/data/schema/damageType';

import type { ElementPart, ElementSource, PlacedSource, Placement } from './types';

/** Of two innate elements, the one listed first here combines first (BIBLE §6). */
const INNATE_ORDER: readonly DamageType[] = ['heat', 'cold', 'electricity', 'toxin'];

type Indexed = { readonly source: ElementSource; readonly index: number };

const slotOf = (source: ElementSource) => ('slotIndex' in source ? source.slotIndex : undefined);

/** Slot by slot. Of several elements in one slot (a Riven), the last listed comes first. */
const inSlotOrder = (a: Indexed, b: Indexed) =>
  (slotOf(a.source) ?? 0) - (slotOf(b.source) ?? 0) || b.index - a.index;

const inInnateOrder = (a: ElementSource, b: ElementSource) =>
  INNATE_ORDER.indexOf(a.element) - INNATE_ORDER.indexOf(b.element);

/** Mods by slot, then innate elements. */
const inOrder = (sources: readonly ElementSource[]): readonly ElementSource[] => {
  const slotted = sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => slotOf(source) !== undefined)
    .sort(inSlotOrder)
    .map(({ source }) => source);
  const innate = sources.filter((source) => slotOf(source) === undefined).sort(inInnateOrder);
  return [...slotted, ...innate];
};

const placementOf = (source: ElementSource, isFirst: boolean): Placement => {
  if (!isFirst) return 'joined';
  return slotOf(source) === undefined ? 'last' : 'slot';
};

export const partOf = (element: DamageType, sources: readonly PlacedSource[]): ElementPart => ({
  element,
  ratio: sources.reduce((sum, { ratio }) => sum + ratio, 0),
  sources,
});

/**
 * The primaries in the order they combine, one part per element. An element's first source decides
 * its place and the others join it, innate ones included (BIBLE §6).
 */
export const placeElements = (sources: readonly ElementSource[]): readonly ElementPart[] => {
  const groups = new Map<DamageType, PlacedSource[]>();
  for (const source of inOrder(sources)) {
    const group = groups.get(source.element) ?? [];
    group.push({ ...source, placement: placementOf(source, group.length === 0) });
    groups.set(source.element, group);
  }
  return [...groups].map(([element, placed]) => partOf(element, placed));
};
