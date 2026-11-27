import type { Assumptions } from '@/assumptions';
import type { DotRule } from '@/build/dotRules';

/**
 * The seconds after the proc that a DoT ticks (the wiki's Damage over Time page), one a second, with D
 * the duration times status duration. Slash, Toxin and Heat wait a second and tick ⌊D − 1⌋ + 1 times.
 * Electricity and Gas tick from the proc while it lasts, ⌈D⌉ times: a tick at the very end deals
 * nothing (T-8, immediateDotsTickToTheEnd).
 */
export const tickTimes = (
  { delay, duration }: Pick<DotRule, 'delay' | 'duration'>,
  scale: number,
  { immediateDotsTickToTheEnd }: Pick<Assumptions, 'immediateDotsTickToTheEnd'>,
): readonly number[] => {
  const lasting = duration * scale;
  const toTheEnd = delay === 0 && immediateDotsTickToTheEnd;
  const count = toTheEnd ? Math.ceil(lasting) : Math.floor(lasting - 1) + 1;
  return Array.from({ length: count }, (_, index) => delay + index);
};
