import type { GoldenFixture } from '@abacus/data/schema/goldenFixture';
import type { Scenario } from '@abacus/data/schema/scenario';
import { evaluate } from '@abacus/engine';

import { libraryWith } from './loadFixtures';
import type { Run } from './replay';
import { enemyWith } from './replay';

/** A case's scenario evaluated, and again on an enemy with less left, through the public API alone. */
export const runOf = (fixture: GoldenFixture, scenario: Scenario): Run => {
  const library = libraryWith(fixture);
  return {
    result: evaluate(scenario, library),
    again: (left, layer) =>
      evaluate({ ...scenario, enemy: enemyWith(scenario.enemy, left, layer) }, library),
  };
};
