import type { Factor, HitResult } from '@abacus/engine';

/** What a mismatch is explained with: a hit's trace, and the number its white hit shows. */
type Explained = Pick<HitResult, 'perType' | 'total'> & {
  readonly trace: Pick<HitResult['trace'], 'factors'>;
  readonly crit: Pick<HitResult['crit'], 'expected'>;
};

const round = (value: number) => Number(value.toPrecision(6));

const pad = (cells: readonly (string | number)[]) =>
  cells
    .map((cell) => String(cell).padEnd(16))
    .join('')
    .trimEnd();

/** What a factor would have to be for the hit to match, if it alone were wrong. */
const neededOf = (
  { type, value }: Factor,
  hit: Explained,
  scale: { tier: number; gap: number },
) => {
  if (type === undefined) return value * (1 + scale.gap / scale.tier);
  const share = ((hit.perType.get(type) ?? 0) * scale.tier) / hit.total;
  return share === 0 ? Infinity : value * (1 + scale.gap / share);
};

/**
 * The factors of a hit, and what each would have to be to explain the reported number on its own.
 * `tier` is what the engine computed for the crit tier in question.
 */
export const explainHit = (hit: Explained, tier: number, observed: number): string => {
  const scale = { tier, gap: observed - tier };
  const white = hit.total / hit.crit.expected;
  const rows = hit.trace.factors.map((factor) => {
    const isCrit = factor.name === 'crit';
    const actual = isCrit ? { ...factor, value: tier / white } : factor;
    const needed = neededOf(actual, hit, scale);
    const from = factor.effects.map(({ source, value }) => `${source.name} ${round(value)}`);
    return pad([
      factor.name,
      factor.type ?? 'all',
      round(actual.value),
      round(needed),
      from.join(', '),
    ]);
  });
  const off = `${round((scale.gap / tier) * 100)}% off`;
  return [off, pad(['factor', 'type', 'value', 'would match at', 'from']), ...rows].join('\n');
};
