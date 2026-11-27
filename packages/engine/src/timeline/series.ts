import type { HitResult } from '@/resolve/resolveHit';
import type { HitTrace } from '@/trace/hitTrace';

import type { TimedHit } from './fight';

/** What the series reads of a hit: when it landed, how much of a pellet it is, and its total. */
type Landed = Pick<TimedHit, 'at' | 'amount'> & { readonly hit: Pick<HitResult, 'total'> };

/** Damage over time: what each step of the fight dealt, from its start, direct and DoT apart. */
export type Series = {
  /** Seconds a step lasts. */
  readonly step: number;
  readonly direct: readonly number[];
  readonly dot: readonly number[];
};

/** A tenth of a second, as BIBLE §9 asks. */
export const STEP = 0.1;

/** Slack for a time that lands on a step's start, such as 0.3 s, which 0.3 ÷ 0.1 puts just below. */
const SLACK = 1e-9;

/** The step a hit lands in. The last step has the moment the fight ends, and the hit that ended it. */
const stepOf = (at: number, steps: number) => Math.min(Math.floor(at / STEP + SLACK), steps - 1);

/** What a hit deals: as much of a pellet as it is, times one pellet's damage, as `evaluate` counts. */
export const damageOf = ({ amount, hit }: Omit<Landed, 'at'>): number => amount * hit.total;

/** The direct damage of each step of a fight that lasted this long. DoT stays 0 until ABA-69. */
export const seriesOf = (hits: readonly Landed[], lasted: number): Series => {
  const steps = Math.max(Math.ceil(lasted / STEP - SLACK), 1);
  const direct = Array.from({ length: steps }, () => 0);
  for (const hit of hits) {
    const index = stepOf(hit.at, steps);
    direct[index] = (direct[index] ?? 0) + damageOf(hit);
  }
  return { step: STEP, direct, dot: direct.map(() => 0) };
};

/** At most this many hit traces in a result: a fight can have thousands. */
export const MOST_TRACES = 200;

/** The traces of the hits, or as many as are kept, evenly spread, the first and the last among them. */
export const sampleTraces = (
  hits: readonly { readonly hit: Pick<HitResult, 'trace'> }[],
): readonly HitTrace[] => {
  const traces = hits.map(({ hit }) => hit.trace);
  if (traces.length <= MOST_TRACES) return traces;
  const spread = (traces.length - 1) / (MOST_TRACES - 1);
  return Array.from(
    { length: MOST_TRACES },
    (_, index) => traces[Math.round(index * spread)],
  ).filter((trace): trace is HitTrace => trace !== undefined);
};
