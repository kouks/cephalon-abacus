import type { Scenario } from '@abacus/data/schema/scenario';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { CollectedEffect, Warning } from '@/build/types';

import { combiningElement } from './elementSources';

/** Settings about elements that change nothing in this build. */
export const checkElements = (
  { elementOrder, progenitor }: Scenario['build'],
  weapon: Weapon,
  effects: readonly CollectedEffect[],
): readonly Warning[] => {
  const elemental = new Set(
    effects
      .filter(({ bucket }) => combiningElement(bucket) !== undefined)
      .map(({ source }) => source.id),
  );
  const unused = elementOrder
    .filter((id) => !elemental.has(id))
    .map((sourceId): Warning => ({ code: 'unusedElement', sourceId }));
  const isRefused = progenitor !== undefined && weapon.progenitor === undefined;
  return isRefused ? [...unused, { code: 'noProgenitor', weaponId: weapon.id }] : unused;
};
