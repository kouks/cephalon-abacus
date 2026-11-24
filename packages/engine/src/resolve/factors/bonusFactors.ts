import { ALL_FACTIONS } from '@abacus/data/load/findBucket';

import { aggregate, joinTotals } from '@/build/aggregate';
import { memberTotal } from '@/build/stats/moddedStat';
import type { BucketTotals } from '@/build/totalBuckets';
import type { Target } from '@/resolve/target';
import type { Factor } from '@/trace/hitTrace';

import { effectsOf, factor } from './factor';

/** 1 + F: the bonuses against the target's faction, and those against all (BIBLE §5). */
export const factionFactor = (totals: BucketTotals, { faction }: Target): Factor => {
  const group = faction?.factionModGroup;
  const groups = group === undefined ? [] : [memberTotal(totals, `damage.faction.${group}`)];
  const bonus = joinTotals(memberTotal(totals, `damage.faction.${ALL_FACTIONS}`), ...groups);
  return factor('faction', aggregate(bonus, 1), effectsOf([bonus]));
};

const FINAL = 'damage.final.';

/** Each final multiplier stands on its own (BIBLE §5). */
export const finalFactors = (totals: BucketTotals): readonly Factor[] =>
  [...totals]
    .filter(([bucket]) => bucket.startsWith(FINAL))
    .map(([bucket, total]) =>
      factor(`final.${bucket.slice(FINAL.length)}`, aggregate(total, 1), effectsOf([total])),
    );
