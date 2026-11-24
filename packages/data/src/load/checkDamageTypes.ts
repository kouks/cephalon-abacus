import type { DamageType } from '@/schema/damageType';
import { DAMAGE_TYPES } from '@/schema/damageType';
import type { DamageTypeRule } from '@/schema/damageTypeRule';

import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import { DAMAGE_TYPES_FILE } from './places';
import type { Located } from './readItems';

const pairOf = ({ combinesFrom }: DamageTypeRule) => [...(combinesFrom ?? [])].sort().join(' + ');

/** The first type each pair of primaries makes. */
const makersOf = (located: readonly Located<DamageTypeRule>[]) => {
  const makers = new Map<string, DamageType>();
  for (const { item } of located) {
    if (!makers.has(pairOf(item))) makers.set(pairOf(item), item.id);
  }
  return makers;
};

/** Every damage type has a rule, and each secondary has two primaries to itself. */
export const checkDamageTypes = (
  located: readonly Located<DamageTypeRule>[],
): readonly LibraryError[] => {
  const groups = new Map(located.map(({ item }) => [item.id, item.group]));
  const makers = makersOf(located);

  const missing = DAMAGE_TYPES.filter((type) => !groups.has(type)).map((type) =>
    errorAt(DAMAGE_TYPES_FILE, ['items'], `No entry for "${type}"`),
  );
  const wrong = located.flatMap(({ item, file, index }) => {
    const path = ['items', index, 'combinesFrom'];
    const parts = item.combinesFrom ?? [];
    const maker = makers.get(pairOf(item));
    return [
      ...parts
        .filter((part) => groups.get(part) !== 'primary')
        .map((part) => errorAt(file, path, `"${part}" is not a primary`)),
      ...(parts.length === 0 || maker === item.id
        ? []
        : [errorAt(file, path, `${pairOf(item)} already makes "${String(maker)}"`)]),
    ];
  });
  return [...missing, ...wrong];
};
