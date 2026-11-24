import type { Assumptions } from '@/assumptions';
import type { CollectedEffect } from '@/build/types';

/** What Cold on the target adds to crit damage, e.g. 0.5 at nine stacks (BIBLE §7). Not in AoE. */
export const coldCritEffect = (
  bonus: number,
  { coldCritDamageAbsolute }: Assumptions,
): CollectedEffect => ({
  source: { id: 'cold', name: 'Cold' },
  ...(coldCritDamageAbsolute
    ? { bucket: 'crit.damageFlat', op: 'ADD' }
    : { bucket: 'crit.damage', op: 'STACKING_MULTIPLY' }),
  value: bonus,
  times: [],
  scope: ['direct'],
});
