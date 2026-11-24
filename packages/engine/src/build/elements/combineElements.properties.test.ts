import fc from 'fast-check';
import { expect, it } from 'vitest';

import type { DamageType } from '@abacus/data/schema/damageType';

import { DAMAGE_TYPES } from '@/testing/damageTypes';
import { mod } from '@/testing/elements';

import { combineElements } from './combineElements';
import type { ElementSource } from './types';

const PRIMARIES: readonly DamageType[] = ['heat', 'cold', 'electricity', 'toxin'];

const bonus = fc.tuple(
  fc.constantFrom(...PRIMARIES),
  fc.double({ min: 0.01, max: 3, noNaN: true }),
);

/** Up to eight elemental mods, one per slot. */
const build = fc
  .array(bonus, { maxLength: 8 })
  .map((bonuses) => bonuses.map((entry, slot) => mod(slot, `Mod ${slot}`, entry)));

const combine = (sources: readonly ElementSource[]) =>
  combineElements(sources, DAMAGE_TYPES).ratios;

const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

const sumOf = (sources: readonly ElementSource[]) => sum(sources.map(({ ratio }) => ratio));

const distinct = (sources: readonly ElementSource[]) =>
  new Set(sources.map(({ element }) => element)).size;

const primariesLeft = (sources: readonly ElementSource[]) =>
  [...combine(sources).keys()].filter((type) => PRIMARIES.includes(type));

const namesOf = (sources: readonly ElementSource[]) => [...combine(sources).keys()].sort();

it('no damage appears or disappears', () => {
  fc.assert(
    fc.property(build, (sources) => {
      expect(sum(combine(sources).values())).toBeCloseTo(sumOf(sources), 9);
    }),
  );
});

it('a secondary uses up its parts, so one primary is left over or none', () => {
  fc.assert(
    fc.property(build, (sources) => {
      expect(primariesLeft(sources)).toHaveLength(distinct(sources) % 2);
    }),
  );
});

it('only slots matter, not the order of the list', () => {
  fc.assert(
    fc.property(build, (sources) => {
      expect(namesOf([...sources].reverse())).toEqual(namesOf(sources));
    }),
  );
});
