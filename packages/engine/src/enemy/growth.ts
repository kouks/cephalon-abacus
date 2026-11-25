import type { ScalingCurve } from '@abacus/data/schema/scaling';

/** Enemy stats are worked out in 32 bits, step by step: BIBLE §10. */
export const f32 = Math.fround;

/** How far a stat has grown, and the terms that say so. */
export type Growth = {
  /** The levels that count. */
  readonly levels: number;
  readonly low: number;
  readonly high: number;
  /** How far the low curve has become the high one: 0 to 1. */
  readonly blend: number;
  readonly multiplier: number;
};

const endpoint = ({ coefficient, exponent }: ScalingCurve['low'], levels: number): number =>
  f32(1 + f32(f32(coefficient) * f32(levels ** f32(exponent))));

/** Smoothstep. */
const blendAt = ({ from, to }: ScalingCurve['blend'], levels: number): number => {
  const share = f32(f32(levels - from) / f32(to - from));
  const t = Math.min(Math.max(share, 0), 1);
  return f32(f32(t * t) * f32(3 - f32(2 * t)));
};

type Levels = { readonly level: number; readonly baseLevel: number };

/** Both curves count at every level, in this order: rearranged, the last bits differ (BIBLE §10). */
export const growthAt = (curve: ScalingCurve, { level, baseLevel }: Levels): Growth => {
  const levels = Math.max(level - (curve.above === 'one' ? 1 : baseLevel), 0);
  const low = endpoint(curve.low, levels);
  const high = endpoint(curve.high, levels);
  const blend = blendAt(curve.blend, levels);
  const multiplier = f32(low + f32(f32(high - low) * blend));
  return { levels, low, high, blend, multiplier };
};
