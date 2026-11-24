/** A library and scenarios for build tests: real mods, as the wiki states them. */
import type { Library } from '@abacus/data/load/library';
import { formatError } from '@abacus/data/load/libraryError';
import { loadLibrary } from '@abacus/data/load/loadLibrary';
import type { Scenario } from '@abacus/data/schema/scenario';
import { scenarioSchema } from '@abacus/data/schema/scenario';
import {
  bucket,
  faction,
  family,
  libraryFile,
  module,
  referenceFiles,
  scenario,
  weapon,
} from '@abacus/data/testing/fixtures';

import type { Selection } from '@/build/selectEffects';

const stat = (id: string, change: object = {}) => ({ ...bucket, id, stage: 'stats', ...change });

const buckets = libraryFile(
  'buckets.json',
  bucket,
  family,
  stat('multishot', { scope: { direct: 1, aoe: 1 } }),
  stat('crit.chance', { scope: { direct: 1, proc: 1, aoe: 1 } }),
  stat('crit.chanceWeakPoint', { scope: { direct: 1 } }),
  stat('status.chance', { scope: { direct: 1 } }),
  stat('fireRate', { scope: {} }),
  stat('ammoEfficiency', { scope: {}, op: 'ADD', max: 0.75 }),
);

const factions = libraryFile('factions.json', faction, {
  ...faction,
  id: 'corpus',
  factionModGroup: 'corpus',
});

const [effect] = module.effects;

export const add = (name: string, value: unknown, change: object = {}) => ({
  ...effect,
  bucket: name,
  value,
  ...change,
});

export const mod = (id: string, effects: readonly object[], change: object = {}) => ({
  ...module,
  id,
  name: id,
  effects,
  ...change,
});

const stacks = (max: number) => ({ max, perTrigger: 1, decay: 'one', duration: 20 });

export const when = (trigger: string, max?: number) => ({
  condition: { trigger, target: 'self', ...(max === undefined ? {} : { stacks: stacks(max) }) },
});

export const SERRATION = mod('serration', [add('damage.base', 1.65)], {
  exclusiveGroup: 'serration',
});

export const AMALGAM_SERRATION = mod('amalgam-serration', [add('damage.base', 1.55)], {
  exclusiveGroup: 'serration',
});

export const HEAVY_CALIBER = mod('heavy-caliber', [add('damage.base', 1.65)]);

export const SPLIT_CHAMBER = mod('split-chamber', [add('multishot', 0.9)], {
  rank: { max: 5, perRank: 'linear' },
});

/** +80% multishot; on kill +30%, up to 5 stacks. */
export const GALVANIZED_CHAMBER = mod('galvanized-chamber', [
  add('multishot', 0.8),
  add('multishot', 0.3, when('onKill', 5)),
]);

/** On headshot +120% crit chance; on weak point kill +40%, up to 5 stacks. */
export const GALVANIZED_SCOPE = mod('galvanized-scope', [
  add('crit.chance', 1.2, when('onHeadshot')),
  add('crit.chance', 0.4, when('onWeakPointKill', 5)),
]);

/** +80% status chance; on kill +40% damage per status type, up to 2 stacks, direct hits only. */
export const GALVANIZED_APTITUDE = mod('galvanized-aptitude', [
  add('status.chance', 0.8),
  add(
    'damage.base',
    { value: 0.4, times: ['stack', 'statusType'] },
    { scope: ['direct'], ...when('onKill', 2) },
  ),
]);

export const PRIMARY_ACUITY = mod(
  'primary-acuity',
  [add('crit.chanceWeakPoint', 3.5, { filter: { bodyPart: 'weakPoint' } })],
  { locks: ['multishot'] },
);

export const makeLibrary = (modules: readonly object[], weaponChange: object = {}): Library => {
  const result = loadLibrary([
    ...referenceFiles.filter(({ path }) => path === 'damageTypes.json'),
    buckets,
    factions,
    libraryFile('mods/a.json', ...modules),
    libraryFile('weapons/a.json', { ...weapon, ...weaponChange }),
  ]);
  if (!result.ok) throw new Error(result.errors.map(formatError).join('\n'));
  return result.library;
};

export const makeScenario = (modules: readonly object[], change: object = {}): Scenario =>
  scenarioSchema.parse({ ...scenario, build: { ...scenario.build, modules, ...change } });

export const DIRECT: Selection = { scope: 'direct', attackTags: new Set() };
