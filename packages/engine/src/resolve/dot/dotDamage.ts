import type { HitTrace } from '@/trace/hitTrace';

/**
 * What a hit's DoT procs deal over all their ticks, in expected value (BIBLE §8): each proc's share,
 * by its crit tier's chance, times its tick and how many times it ticks. Each proc counts on its own:
 * Heat's merging, and Electricity's and Gas's ticks that share one +1, are the timeline's.
 */
export const dotDamageOf = ({ dots }: Pick<HitTrace, 'dots'>): number =>
  dots.reduce(
    (sum, { count, chance, damage, times }) => sum + count * chance * damage * times.length,
    0,
  );
