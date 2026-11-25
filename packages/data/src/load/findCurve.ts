import type { ScaledStat, ScalingCurve, ScalingRule } from '@/schema/scaling';

import type { Reference } from './library';

export const isCurve = (rule: ScalingRule): rule is ScalingCurve => rule.kind === 'curve';

/** The curve a stat grows along in a scaling profile. */
export const findCurve = (
  stat: ScaledStat,
  profile: string,
  { scaling }: Pick<Reference, 'scaling'>,
): ScalingCurve | undefined =>
  [...scaling.values()]
    .filter(isCurve)
    .find((curve) => curve.stat === stat && curve.profiles?.includes(profile) !== false);
