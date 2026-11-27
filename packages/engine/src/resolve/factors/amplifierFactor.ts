import type { Layer } from '@abacus/data/schema/damageTypeRule';

import { aggregate } from '@/build/aggregate';
import type { BucketTotals } from '@/build/totalBuckets';
import type { Factor } from '@/trace/hitTrace';

import { factor } from './factor';
import type { Met } from './layerFactors';

/** What statuses amplify on each layer: Viral on health, Magnetic on shields and Overguard. */
const AMPLIFIED: Readonly<Record<Layer, string>> = {
  overguard: 'enemy.shield',
  shield: 'enemy.shield',
  health: 'enemy.health',
};

/**
 * 1 + Σ STACKING_MULTIPLY of what the statuses on the enemy amplify on the layer the hit meets
 * (BIBLE §8). Without a defence the hit meets bare health.
 */
export const amplifierFactor = (totals: BucketTotals, met: Met | undefined): Factor => {
  const total = totals.get(AMPLIFIED[met?.defence.layer ?? 'health']);
  if (total === undefined) return factor('amplifier', 1);
  return factor('amplifier', aggregate(total, 1), total.contributions);
};
