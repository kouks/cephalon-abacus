/** The buckets of the test library: the real ones the tests name, scoped as buckets.json has them. */
import { bucket, family, libraryFile } from '@abacus/data/testing/fixtures';

import { ELEMENTS } from './damageTypes';

const stat = (id: string, change: object = {}) => ({ ...bucket, id, stage: 'stats', ...change });

const members = (id: string, ...types: readonly string[]) => ({
  ...bucket,
  id,
  scope: { direct: 1, aoe: 1 },
  members: types,
});

/** Every bucket the build tests name, as buckets.json has them. */
export const buckets = libraryFile(
  'buckets.json',
  { ...bucket, scope: { direct: 1, proc: 1, aoe: 1 } },
  family,
  { ...bucket, id: 'damage.final', op: 'MULTIPLY', scope: { direct: 1, aoe: 1 }, members: 'any' },
  stat('weakPoint.damage', { scope: { direct: 1 }, op: 'ADD', bodyPart: 'weakPoint' }),
  stat('headshot.damage', { scope: { direct: 1 }, bodyPart: 'head' }),
  members('damage.ips', 'impact', 'puncture', 'slash'),
  { ...members('damage.element', ...ELEMENTS), scope: { direct: 1, proc: 1, aoe: 1 } },
  members('damage.elementNoCombine', ...ELEMENTS),
  stat('multishot', { scope: { direct: 1, aoe: 1 } }),
  stat('crit.chance', { scope: { direct: 1, proc: 1, aoe: 1 } }),
  stat('crit.chanceCombo', { scope: { direct: 1, aoe: 1 } }),
  stat('crit.chanceWeakPoint', { scope: { direct: 1 }, bodyPart: 'weakPoint' }),
  stat('crit.chanceFlat', { scope: { direct: 1, aoe: 1 }, op: 'ADD' }),
  stat('crit.damage', { scope: { direct: 1, proc: 1, aoe: 1 } }),
  stat('crit.damageFlat', { scope: { direct: 1, aoe: 1 }, op: 'ADD' }),
  stat('crit.damageFinal', { scope: { direct: 1, aoe: 1 }, op: 'MULTIPLY' }),
  stat('status.chance', { scope: { direct: 1 } }),
  { ...bucket, id: 'status.damage', scope: { proc: 1 }, stage: 'proc' },
  stat('status.duration', { scope: { proc: 1 } }),
  ...[
    ...['fireRate', 'status.chanceFlat', 'magazine', 'ammoMax', 'reload'],
    ...['punchThrough', 'range', 'projectileSpeed', 'aoeRadius'],
  ].map((id) => stat(id, { scope: {} })),
  stat('ammoEfficiency', { scope: {}, op: 'ADD', max: 0.75 }),
  {
    ...members('enemy', 'armor', 'damage', 'health', 'shield', 'status'),
    scope: {},
    stage: 'target',
    op: 'MULTIPLY',
  },
);
