import type { Scope } from '@abacus/data/schema/effect';

import type { Assumptions } from '@/assumptions';
import { totalOf } from '@/build/aggregate';
import type { BuiltAttack } from '@/build/buildAttack';
import type { BucketTotals } from '@/build/totalBuckets';
import type { Contribution } from '@/build/types';

/** What a status on the enemy does to the hits that meet it: a contribution, and what it reaches. */
export type Taken = Contribution & { readonly scope?: readonly Scope[] };

type Meeting = { readonly scope: Scope; readonly assumptions: Assumptions };

/** Cold's crit damage adds to the multiplier, or is a share of the base without coldCritDamageAbsolute (T-5). */
const asAssumed = (taken: Taken, { coldCritDamageAbsolute }: Assumptions): Taken =>
  taken.bucket === 'crit.damageFlat' && !coldCritDamageAbsolute
    ? { ...taken, bucket: 'crit.damage', op: 'STACKING_MULTIPLY' }
    : taken;

const contributionOf = ({ source, bucket, op, value }: Taken): Contribution => ({
  source,
  bucket,
  op,
  value,
});

/** A hit's bucket totals, with what the statuses on the enemy add to them where they reach it. */
export const totalsWithTaken = (
  totals: BucketTotals,
  taken: readonly Taken[],
  { scope, assumptions }: Meeting,
): BucketTotals => {
  const reaching = taken.filter((entry) => entry.scope?.includes(scope) ?? true);
  const added = new Map(totals);
  for (const entry of reaching.map((each) => asAssumed(each, assumptions))) {
    const total = added.get(entry.bucket);
    const contributions = [...(total?.contributions ?? []), contributionOf(entry)];
    added.set(entry.bucket, totalOf(entry.bucket, contributions, total ?? {}));
  }
  return added;
};

/** The scope of an attack's hits: an explosion's, or a direct hit's. */
const scopeOf = ({ attack }: BuiltAttack): Scope =>
  attack.flags?.includes('isAoE') === true ? 'aoe' : 'direct';

/** The attack, with what the statuses on the enemy add to its buckets (BIBLE §8). */
export const withTaken = (built: BuiltAttack, taken: readonly Taken[]): BuiltAttack => ({
  ...built,
  totals: totalsWithTaken(built.totals, taken, {
    scope: scopeOf(built),
    assumptions: built.assumptions,
  }),
});
