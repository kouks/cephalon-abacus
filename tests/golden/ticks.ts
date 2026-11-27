import { COLOURS } from '@abacus/data/schema/goldenFixture';
import type { Observed, Tick } from '@abacus/data/schema/goldenFixture';
import type { DotTrace, HitResult } from '@abacus/engine';

import type { Comparison } from './comparison';

const round = (value: number) => Number(value.toPrecision(6));

const pad = (cells: readonly (string | number)[]) =>
  cells
    .map((cell) => String(cell).padEnd(16))
    .join('')
    .trimEnd();

/** A tick's factors, and what each would have to be to explain the reported number on its own. */
const explainTick = (dot: DotTrace, observed: number): string =>
  dot.factors
    .map(({ name, type, value }) =>
      pad([name, type ?? '', round(value), round((value * observed) / dot.damage)]),
    )
    .join('\n');

const compareTick = (
  { status, of, shown }: Tick,
  hit: HitResult,
  tolerance: number,
): Comparison => {
  const tier = COLOURS.indexOf(of);
  const dot = hit.trace.dots.find((entry) => entry.status === status && entry.tier === tier);
  const what = `${status} tick of a ${of} hit`;
  const comparison = { what, observed: shown, computed: dot?.damage, tolerance };
  return dot === undefined
    ? { ...comparison, explain: () => `The hit inflicts no ${status} of this tier` }
    : { ...comparison, explain: () => explainTick(dot, shown) };
};

/** The ticks of the procs a hit inflicted, against the engine's (BIBLE §8). */
export const compareTicks = (
  { ticks = [] }: Observed,
  hit: () => HitResult,
  tolerance: number,
): readonly Comparison[] => ticks.map((tick) => compareTick(tick, hit(), tolerance));
