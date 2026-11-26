/** The damage types with their real groups and combinations. */
import type { Reference } from '@abacus/data/load/library';
import type { DamageType } from '@abacus/data/schema/damageType';
import { damageTypeRuleSchema } from '@abacus/data/schema/damageTypeRule';
import { damageTypes } from '@abacus/data/testing/fixtures';

import { PROCS } from './statuses';

const PHYSICAL: readonly DamageType[] = ['impact', 'puncture', 'slash'];
const PRIMARIES: readonly DamageType[] = ['heat', 'cold', 'electricity', 'toxin'];

const COMBINATIONS: Readonly<Partial<Record<DamageType, readonly DamageType[]>>> = {
  blast: ['heat', 'cold'],
  corrosive: ['electricity', 'toxin'],
  gas: ['heat', 'toxin'],
  magnetic: ['cold', 'electricity'],
  radiation: ['heat', 'electricity'],
  viral: ['cold', 'toxin'],
};

const groupOf = (type: DamageType) => {
  if (PHYSICAL.includes(type)) return 'physical';
  if (PRIMARIES.includes(type)) return 'primary';
  return COMBINATIONS[type] === undefined ? 'special' : 'secondary';
};

/** The elements a bonus can add. */
export const ELEMENTS: readonly string[] = [...PRIMARIES, ...Object.keys(COMBINATIONS)];

/** As items of damageTypes.json. */
export const damageTypeItems = damageTypes.map((item) => {
  const combinesFrom = COMBINATIONS[item.id];
  const proc = PROCS[item.id];
  return {
    ...item,
    group: groupOf(item.id),
    ...(combinesFrom === undefined ? {} : { combinesFrom }),
    ...(proc === undefined ? {} : { proc }),
  };
});

export const DAMAGE_TYPES: Reference['damageTypes'] = new Map(
  damageTypeItems.map((item) => {
    const rule = damageTypeRuleSchema.parse(item);
    return [rule.id, rule];
  }),
);
