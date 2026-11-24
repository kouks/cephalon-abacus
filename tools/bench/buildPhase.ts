/** `pnpm bench`: how long phase A takes for a full build. Fails above the limit. */
import { must } from '#data/assert.ts';
import { scenarioSchema } from '#data/schema/scenario.ts';
import { scenario } from '#data/testing/fixtures.ts';
import { buildAttack } from '#engine/build/buildAttack.ts';
import { makeLoadout } from '#engine/build/loadout.ts';

import { loadRealLibrary } from '../data/loadRealLibrary.ts';
import { quantile } from './quantile.ts';

const LIMIT_MS = 1;
const WARM_UP = 500;
const RUNS = 2000;

const MODS = [
  'serration',
  'split-chamber',
  'point-strike',
  'vital-sense',
  'hellfire',
  'cryo-rounds',
  'infected-clip',
  'speed-trigger',
];

const library = loadRealLibrary();
const modules = MODS.map((moduleId) => ({ moduleId }));
const build = { ...scenario.build, weaponId: 'soma-prime', modules };
const full = scenarioSchema.parse({ ...scenario, build });

const { warnings, effects } = makeLoadout(full, library).collected;
if (warnings.length > 0 || effects.length < MODS.length) throw new Error('Not a full build');

const buildOnce = () => {
  const loadout = makeLoadout(full, library);
  buildAttack(loadout, must(loadout.weapon.attacks[0], 'A weapon has an attack'));
};

const time = () => {
  const start = performance.now();
  buildOnce();
  return performance.now() - start;
};

for (let run = 0; run < WARM_UP; run += 1) buildOnce();
const sample = Array.from({ length: RUNS }, time);

const [median, slow] = [0.5, 0.95].map((share) => quantile(sample, share).toFixed(3));
console.log(
  `Build phase, 8 mods: median ${median} ms, 95% under ${slow} ms (limit ${LIMIT_MS} ms)`,
);
if (Number(median) > LIMIT_MS) process.exitCode = 1;
