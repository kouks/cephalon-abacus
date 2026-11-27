import type { Factor, FactorName } from '@/trace/hitTrace';

/**
 * The factors of a hit that its procs keep (the wiki's Damage over Time page): the modded base,
 * faction, final multipliers, the body part, and falloff over distance and from an explosion's
 * centre. Not the type shares, which are quantized and carry the elemental and physical mods, nor
 * what the target does to the hit. Range and landing are all or nothing: a hit that doesn't get to
 * the target inflicts no procs.
 */
const KEPT: ReadonlySet<FactorName> = new Set([
  'base',
  'faction',
  'bodyPart',
  'falloff',
  'radialFalloff',
]);

const isKept = ({ name }: Factor) => KEPT.has(name) || name.startsWith('final.');

/** A proc's seed before its crit tier: the product of the hit's factors it keeps. */
export const seedOf = (factors: readonly Factor[]): number =>
  factors.filter(isKept).reduce((product, { value }) => product * value, 1);
