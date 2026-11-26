import type { DamageType } from '@abacus/data/schema/damageType';

import type { Defence } from '@/resolve/defence';
import { armorShare } from '@/resolve/defence';
import type { Factor } from '@/trace/hitTrace';

import { factor } from './factor';

/** What a type does to the layer: 0 where it skips it, 1.5 for Void on Overguard. */
const layerShare = (type: DamageType, { layer, rules }: Defence) =>
  rules.get(type)?.layers[layer] ?? 0;

/** Armor reduces health only, and not the types that bypass it. */
const armorOf = (type: DamageType, { layer, armor, rules }: Defence) =>
  layer === 'health' && rules.get(type)?.bypassArmor !== true ? armorShare(armor) : 1;

/**
 * A_layer and armor per type, then the other reductions (BIBLE §3, §10). Without a defence the
 * hit meets bare health: everything is 1.
 */
export const layerFactors = (
  types: Iterable<DamageType>,
  defence: Defence | undefined,
): readonly Factor[] => [
  ...[...types].flatMap((type) => [
    { ...factor('layer', defence === undefined ? 1 : layerShare(type, defence)), type },
    { ...factor('armor', defence === undefined ? 1 : armorOf(type, defence)), type },
  ]),
  factor('reduction', 1),
];
