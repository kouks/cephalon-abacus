import type { Enemy } from '@/schema/enemy';
import { baseOf } from '@/schema/enemy';
import { SCALED_STATS } from '@/schema/scaling';

import { findCurve } from './findCurve';
import type { Reference } from './library';
import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import type { Located } from './readItems';

const checkFaction = ({ faction }: Enemy, { factions }: Reference) =>
  factions.has(faction) ? [] : [['faction', `"${faction}" is not a faction (factions.json)`]];

/** Every stat that the enemy has grows along some curve. */
const checkProfile = (enemy: Enemy, reference: Reference) => {
  const profile = enemy.scalingProfile;
  const base = baseOf(enemy);
  return SCALED_STATS.filter(
    (stat) => base[stat] > 0 && findCurve(stat, profile, reference) === undefined,
  ).map((stat) => ['scalingProfile', `"${profile}" has no curve for ${stat} (scaling.json)`]);
};

export const checkEnemies = (
  enemies: readonly Located<Enemy>[],
  reference: Reference,
): readonly LibraryError[] =>
  enemies.flatMap(({ item, file, index }) =>
    [...checkFaction(item, reference), ...checkProfile(item, reference)].map(
      ([field = '', message = '']) => errorAt(file, ['items', index, field], message),
    ),
  );
