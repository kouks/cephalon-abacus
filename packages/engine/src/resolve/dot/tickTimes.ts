import type { Assumptions } from '@/assumptions';
import type { DotRule } from '@/build/dotRules';

/**
 * The seconds after the proc that a DoT ticks (the wiki's Damage over Time page): one a second from
 * its delay, ⌊D − 1⌋ + 1 of them with D the duration times status duration. Electricity and Gas tick
 * from the proc, and their tick at the end deals nothing, unless immediateDotsTickToTheEnd (T-8).
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
