import { LAYERS } from '@abacus/data/schema/damageTypeRule';
import type { Layered, Observed, Tolerance } from '@abacus/data/schema/goldenFixture';
import type { TierDealt } from '@abacus/engine';

import type { Comparison } from './comparison';
import type { Run } from './replay';
import { dealtOf, inOrder, replay } from './replay';

const round = (value: number) => Number(value.toPrecision(8));

const explainDealt = ({ dealt, left }: TierDealt): string =>
  [
    ...dealt.map(
      ({ layer, shown, applied }) => `${layer}: shows ${shown}, loses ${round(applied)}`,
    ),
    `left after: ${LAYERS.map((layer) => `${layer} ${round(left[layer])}`).join(', ')}`,
  ].join('\n');

const compareOne = ({ before = {}, colour, shown }: Layered, run: Run, within: number) => {
  const left = replay(run, undefined, inOrder(before));
  const dealt = dealtOf(left === undefined ? run.result : run.again(left), colour);
  return LAYERS.flatMap((layer): readonly Comparison[] => {
    const observed = shown[layer];
    if (observed === undefined) return [];
    const computed = dealt.dealt.find((entry) => entry.layer === layer)?.shown;
    const what = `${colour} hit, shown on ${layer}`;
    return [{ what, observed, computed, tolerance: within, explain: () => explainDealt(dealt) }];
  });
};

/** The numbers one hit shows on each layer, after the hits before it (BIBLE §15). */
export const compareLayered = (
  { layered = [] }: Observed,
  run: Run,
  { hits = 0 }: Tolerance,
): readonly Comparison[] => layered.flatMap((entry) => compareOne(entry, run, hits));
