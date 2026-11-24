import type { DamageType } from '@abacus/data/schema/damageType';

import type { Composition } from '@/build/composition/composeDamage';
import type { Target } from '@/resolve/target';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

/** Q_t, in two factors: the modded base, and each type's quantized share of it (BIBLE §6). */
export const damageFactors = ({ moddedBase, types }: Composition): readonly Factor[] => [
  factor('base', moddedBase.value, effectsOf(moddedBase.totals)),
  ...[...types].map(([type, { quantized, effects }]) => ({
    ...factor('share', quantized, effects),
    type,
  })),
];

/** V: what the target's faction is weak to or resists (BIBLE §10). */
export const vulnerabilityFactors = (
  types: Iterable<DamageType>,
  { faction }: Target,
): readonly Factor[] =>
  [...types].map((type) => ({
    ...factor('vulnerability', faction?.damageProfile[type] ?? 1),
    type,
  }));

/** Amplifiers, armor and other reductions: 1 until enemies have layers (ABA-22). */
export const layerFactors = (): readonly Factor[] => [
  factor('layer', 1),
  factor('armor', 1),
  factor('reduction', 1),
];
