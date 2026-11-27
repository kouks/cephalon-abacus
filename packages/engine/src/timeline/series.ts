import type { HitResult } from '@/resolve/resolveHit';
import type { TickTrace } from '@/trace/hitTrace';

import type { TimedHit } from './fight';

/** What the series reads of a hit: when it landed, how much of a pellet it is, and its total. */
type Landed = Pick<TimedHit, 'at' | 'amount'> & { readonly hit: Pick<HitResult, 'total'> };

/** What it reads of a tick: when it landed, how much of a proc it is, and a whole proc's tick. */
type Ticked = Pick<TickTrace, 't' | 'share' | 'damage'>;

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

/** What a tick deals: as much of a proc as it is, times a whole proc's tick. */
export const tickDamageOf = ({ share, damage }: Omit<Ticked, 't'>): number => share * damage;

/** Each step's damage of what landed when. */
const stepsOf = (landed: readonly (readonly [number, number])[], steps: number) => {
  const series = Array.from({ length: steps }, () => 0);
  for (const [at, damage] of landed) {
    const index = stepOf(at, steps);
    series[index] = (series[index] ?? 0) + damage;
  }
  return series;
};

type Dealt = { readonly hits: readonly Landed[]; readonly ticks: readonly Ticked[] };

/** The direct and DoT damage of each step of a fight that lasted this long. */
export const seriesOf = ({ hits, ticks }: Dealt, lasted: number): Series => {
  const steps = Math.max(Math.ceil(lasted / STEP - SLACK), 1);
  return {
    step: STEP,
    direct: stepsOf(
      hits.map((hit) => [hit.at, damageOf(hit)]),
      steps,
    ),
    dot: stepsOf(
      ticks.map((tick) => [tick.t, tickDamageOf(tick)]),
      steps,
    ),
  };
};

/** At most this many hit traces in a result, and as many tick traces: a fight can have thousands. */
export const MOST_TRACES = 200;

/** The traces, or as many as are kept, evenly spread, the first and the last among them. */
export const sampleTraces = <Trace>(traces: readonly Trace[]): readonly Trace[] => {
  if (traces.length <= MOST_TRACES) return traces;
  const spread = (traces.length - 1) / (MOST_TRACES - 1);
  return Array.from(
    { length: MOST_TRACES },
    (_, index) => traces[Math.round(index * spread)],
  ).filter((trace): trace is Trace => trace !== undefined);
};
