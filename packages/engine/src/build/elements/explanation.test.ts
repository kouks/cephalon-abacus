import { describe, expect, it } from 'vitest';

import { DAMAGE_TYPES } from '@/testing/damageTypes';
import {
  ability,
  AMPREX,
  cold,
  electricity,
  heat,
  magneticMight,
  thermite,
  toxin,
} from '@/testing/elements';

import { combineElements } from './combineElements';
import type { ElementPart, ElementSource } from './types';

const describePart = ({ element, sources }: ElementPart) => {
  const from = sources.map(({ name, placement }) => `${name} ${placement}`).join(', ');
  return `${element} (${from})`;
};

const explain = (sources: readonly ElementSource[]) =>
  combineElements(sources, DAMAGE_TYPES).explanation.map(
    ({ element, parts }) => `${element}: ${parts.map(describePart).join(' + ')}`,
  );

describe('the explanation', () => {
  it('names the two elements that formed a secondary, in order', () => {
    expect(explain([toxin(1), cold(0)])).toEqual([
      'viral: cold (Cryo Rounds slot) + toxin (Infected Clip slot)',
    ]);
  });

  it('says which source placed an element and which joined it', () => {
    expect(explain([AMPREX, electricity(0), cold(1), thermite(2), heat(3)])).toEqual([
      'magnetic: electricity (Stormbringer slot, Amprex joined) + cold (Cryo Rounds slot)',
      'heat: heat (Thermite Rounds slot, Hellfire joined)',
    ]);
  });

  it('says when an innate element came last', () => {
    expect(explain([AMPREX, heat(0)])).toEqual([
      'radiation: heat (Hellfire slot) + electricity (Amprex last)',
    ]);
  });

  it('shows what never combines, next to what it added to', () => {
    const sources = [magneticMight(0), cold(1), electricity(2), ability('Frenzy', 'heat')];
    expect(explain(sources)).toEqual([
      'magnetic: cold (Cryo Rounds slot) + electricity (Stormbringer slot) + magnetic (Magnetic Might apart)',
      'heat: heat (Frenzy apart)',
    ]);
  });

  it('adds up, part by part', () => {
    const [radiation] = combineElements([AMPREX, heat(0), thermite(1)], DAMAGE_TYPES).explanation;
    expect(radiation?.ratio).toBe(2.5);
    expect(radiation?.parts.map(({ ratio }) => ratio)).toEqual([1.5, 1]);
  });
});
