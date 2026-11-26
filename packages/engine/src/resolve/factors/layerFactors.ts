import type { DamageType } from '@abacus/data/schema/damageType';

import type { Defence } from '@/resolve/defence';
import { armorShare } from '@/resolve/defence';
import type { ArmorMet } from '@/resolve/strips';
import type { Factor } from '@/trace/hitTrace';

import { factor } from './factor';

/** The defence a hit meets, and the armor on it after strips. */
export type Met = { readonly defence: Defence; readonly armor: ArmorMet };

/** What a type does to the layer: 0 where it skips it, 1.5 for Void on Overguard. */
const layerShare = (type: DamageType, { layer, rules }: Defence) =>
  rules.get(type)?.layers[layer] ?? 0;

/** Armor reduces health only, and not the types that bypass it. Its strips are its effects. */
const armorFactor = (type: DamageType, { defence: { layer, rules }, armor }: Met): Factor => {
  const isReduced = layer === 'health' && rules.get(type)?.bypassArmor !== true;
  if (!isReduced) return { ...factor('armor', 1), type };
  return { ...factor('armor', armorShare(armor.value), armor.strips), type };
};

/**
 * A_layer and armor per type (BIBLE §3, §10). Without a defence the hit meets bare health:
 * everything is 1.
 */
export const layerFactors = (
  types: Iterable<DamageType>,
  met: Met | undefined,
): readonly Factor[] =>
  [...types].flatMap((type) =>
    met === undefined
      ? [
          { ...factor('layer', 1), type },
          { ...factor('armor', 1), type },
        ]
      : [{ ...factor('layer', layerShare(type, met.defence)), type }, armorFactor(type, met)],
  );
