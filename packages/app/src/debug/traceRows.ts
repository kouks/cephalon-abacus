import type { Contribution, Factor } from '@abacus/engine';

import { formatBonus, formatDamage, formatFlat, formatMultiplier } from '@/format/numbers';

/** One factor of one hit, as text. */
export type TraceRow = {
  readonly key: string;
  /** "normal 1, 50% of hits" */
  readonly hit: string;
  readonly factor: string;
  readonly type: string;
  readonly value: string;
  readonly effects: string;
};

const describeEffect = ({ source, op, value, conditional }: Contribution) => {
  const bonus = op === 'ADD' || op === 'OVERRIDE' ? formatFlat(value) : formatBonus(value);
  const stacks =
    conditional === undefined ? '' : ` (${conditional.stacks} of ${conditional.maxStacks} stacks)`;
  return `${source.name} ${bonus}${stacks}`;
};

/** The modded base is damage, and every other factor a multiplier. */
const formatFactor = ({ name, value }: Factor) =>
  name === 'base' ? formatDamage(value) : formatMultiplier(value);

const rowsOf = (hit: string, factors: readonly Factor[]): readonly TraceRow[] =>
  factors.map((factor) => {
    const { name, type = 'all', effects } = factor;
    return {
      key: `${hit} ${name} ${type}`,
      hit,
      factor: name,
      type,
      value: formatFactor(factor),
      effects: effects.map(describeEffect).join(', '),
    };
  });

type Shot = {
  readonly attackId: string;
  readonly shot: {
    readonly hits: readonly {
      readonly share: number;
      readonly hit: { readonly trace: { readonly factors: readonly Factor[] } };
    }[];
  };
};

/** The part of a Result that the rows are made of. */
type Traced = {
  readonly attackId: string;
  readonly byAttack: readonly { readonly attackId: string; readonly shots: readonly Shot[] }[];
};

/** Every factor of every hit of the headline's shot, in one flat list. */
export const traceRows = ({ byAttack, attackId }: Traced): readonly TraceRow[] => {
  const shots = byAttack.find((attack) => attack.attackId === attackId)?.shots ?? [];
  return shots.flatMap(({ attackId: fired, shot }) =>
    shot.hits.flatMap(({ share, hit }, index) =>
      rowsOf(`${fired} ${index + 1}, ${formatBonus(share).slice(1)} of hits`, hit.trace.factors),
    ),
  );
};
