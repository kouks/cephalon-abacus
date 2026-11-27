/** A library and scenarios for build tests: real mods, as the wiki states them. */
import type { Library } from '@abacus/data/load/library';
import { formatError } from '@abacus/data/load/libraryError';
import { loadLibrary } from '@abacus/data/load/loadLibrary';
import type { Scenario } from '@abacus/data/schema/scenario';
import { scenarioSchema } from '@abacus/data/schema/scenario';
import { faction, libraryFile, module, scenario, weapon } from '@abacus/data/testing/fixtures';
import { armorCurve, curve, eximus, shieldCurve, steelPath } from '@abacus/data/testing/scaling';

import type { Selection } from '@/build/selectEffects';

import { buckets } from './buckets';
import { damageTypeItems } from './damageTypes';
import { STATUS_ITEMS } from './statuses';

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

/** On weak point hit +120% crit chance; on weak point kill +40%, up to 5 stacks. */
export const GALVANIZED_SCOPE = mod('galvanized-scope', [
  add('crit.chance', 1.2, when('onWeakPointHit')),
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

export const PRIMARY_ACUITY = mod('primary-acuity', [add('crit.chanceWeakPoint', 3.5)], {
  locks: ['multishot'],
});

export const makeLibrary = (
  modules: readonly object[],
  weaponChange: object = {},
  enemies: readonly object[] = [],
): Library => {
  const result = loadLibrary([
    libraryFile('damageTypes.json', ...damageTypeItems),
    buckets,
    factions,
    libraryFile('scaling.json', curve, armorCurve, shieldCurve, eximus, steelPath),
    libraryFile('statuses.json', ...STATUS_ITEMS),
    libraryFile('mods/a.json', ...modules),
    libraryFile('weapons/a.json', { ...weapon, ...weaponChange }),
    libraryFile('enemies/a.json', ...enemies),
  ]);
  if (!result.ok) throw new Error(result.errors.map(formatError).join('\n'));
  return result.library;
};

export const makeScenario = (modules: readonly object[], change: object = {}): Scenario =>
  scenarioSchema.parse({ ...scenario, build: { ...scenario.build, modules, ...change } });

export const DIRECT: Selection = { scope: 'direct', attackTags: new Set() };
