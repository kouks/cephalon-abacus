import { must } from '@abacus/data/assert';
import type { Colour, Depleted, Observed } from '@abacus/data/schema/goldenFixture';
import { COLOURS } from '@abacus/data/schema/goldenFixture';
import type { EnemyStats, HitResult } from '@abacus/engine';

import type { Comparison } from './comparison';

type Hit = Pick<HitResult, 'tiers'>;

const damageOf = (colour: Colour, { tiers }: Hit): number => {
  const found = tiers.find(({ tier }) => tier === COLOURS.indexOf(colour));
  return must(found, `No ${colour} hit can happen at this crit chance`).total;
};

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

const dealtIn = (stages: readonly Depleted[], hit: Hit): number =>
  sum(
    stages.flatMap(({ hits }) =>
      COLOURS.map((colour) => {
        const count = hits[colour] ?? 0;
        return count === 0 ? 0 : count * damageOf(colour, hit);
      }),
    ),
  );

const explainLayers = (stages: readonly Depleted[], enemy: EnemyStats): string =>
  stages
    .flatMap(({ layer }) =>
      enemy[layer].terms.map(
        ({ name, value }) => `${layer} ${name} ${Number(value.toPrecision(8))}`,
      ),
    )
    .join('\n');

/**
 * The hits until a layer was gone, against its size at the enemy's level: all but the last weren't
 * enough. What was left of that one goes on to the next layer, as it does from Overguard (BIBLE §10).
 */
export const compareDepleted = (
  { depleted = [] }: Observed,
  hitOf: () => Hit,
  enemy: EnemyStats | undefined,
): readonly Comparison[] =>
  depleted.map(({ last }, index) => {
    const hit = hitOf();
    const stages = depleted.slice(0, index + 1);
    const atMost = dealtIn(stages, hit);
    const comparison = {
      what: stages.map(({ layer }) => layer).join(' and '),
      moreThan: atMost - damageOf(last, hit),
      atMost,
    };
    return enemy === undefined
      ? { ...comparison, computed: undefined }
      : {
          ...comparison,
          computed: sum(stages.map(({ layer }) => enemy[layer].value)),
          explain: () => explainLayers(stages, enemy),
        };
  });
