import type { Depleted, Observed } from '@abacus/data/schema/goldenFixture';
import type { EnemyStats, LayersLeft } from '@abacus/engine';

import type { Comparison } from './comparison';
import type { Run } from './replay';
import { damageOn, inOrder, replay } from './replay';

/** All of a stage's hits but one of the colour that finished it, and that one last. */
const beforeLast = ({ hits, last }: Depleted) => {
  const all = inOrder(hits);
  const index = all.lastIndexOf(last);
  return [...all.slice(0, index), ...all.slice(index + 1)];
};

const explainStage = ({ layer }: Depleted, enemy: EnemyStats, left: number): string =>
  [
    ...enemy[layer].terms.map(
      ({ name, value }) => `${layer} ${name} ${Number(value.toPrecision(8))}`,
    ),
    `${layer} left before the last hit ${Number(left.toPrecision(8))}`,
  ].join('\n');

type Stage = { readonly comparison: Comparison; readonly left: LayersLeft | undefined };

const stageOf = (stage: Depleted, run: Run, from: LayersLeft | undefined): Stage => {
  const enemy = run.result.enemy;
  const what = stage.layer;
  const before = replay(run, from, beforeLast(stage));
  const after = replay(run, before, [stage.last]);
  if (enemy === undefined || before === undefined) {
    return { comparison: { what, moreThan: 0, atMost: 0, computed: undefined }, left: after };
  }
  const full = enemy[stage.layer].value;
  const taken = full - before[stage.layer];
  const last = damageOn(run, before, { layer: stage.layer, colour: stage.last });
  const explain = () => explainStage(stage, enemy, before[stage.layer]);
  return {
    comparison: { what, moreThan: taken, atMost: taken + last, computed: full, explain },
    left: after,
  };
};

/**
 * The hits until a layer was gone, one after another through the layers as the engine has them: all but
 * the last weren't enough, and the last was. What is left of a hit that breaks a layer goes on as the
 * engine says (BIBLE §10).
 */
export const compareDepleted = ({ depleted = [] }: Observed, run: Run): readonly Comparison[] => {
  let left: LayersLeft | undefined;
  return depleted.map((stage) => {
    const done = stageOf(stage, run, left);
    left = done.left;
    return done.comparison;
  });
};
