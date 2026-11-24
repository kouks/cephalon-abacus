/** A hit's damage by type, from mods to 32nds. */
import { must } from '@abacus/data/assert';
import type { DamageMap, DamageType } from '@abacus/data/schema/damageType';
import { weapon } from '@abacus/data/testing/fixtures';

import type { Assumptions } from '@/assumptions';
import { DEFAULT_ASSUMPTIONS } from '@/assumptions';
import { collectEffects } from '@/build/collectEffects';
import type { Composition } from '@/build/composition/composeDamage';
import { composeDamage } from '@/build/composition/composeDamage';
import { selectionOf } from '@/build/selectEffects';
import { contributionsTo, sumBuckets } from '@/build/totalBuckets';

import { add, makeLibrary, makeScenario, mod } from './build';

type Setup = {
  readonly damage?: DamageMap;
  readonly modules?: readonly { readonly id: string }[];
  readonly weaponChange?: object;
  /** Ids of the modules that come with the mission instead of the build. */
  readonly mission?: readonly string[];
  /** Changes to the scenario's build. */
  readonly build?: object;
  readonly assumptions?: Partial<Assumptions>;
};

const [baseAttack] = weapon.attacks;

const scenarioWith = (
  modules: readonly { readonly id: string }[],
  mission: readonly string[],
  build: object = {},
) => {
  const ids = modules.filter(({ id }) => !mission.includes(id)).map(({ id }) => ({ moduleId: id }));
  const scenario = makeScenario(ids, build);
  const modifiers = mission.map((moduleId) => ({ moduleId }));
  return { ...scenario, enemy: { ...scenario.enemy, modifiers } };
};

/** The test rifle's damage: 30 Impact, 30 Puncture and 40 Slash. */
export const compose = (setup: Setup = {}) => {
  const { damage = {}, modules = [], mission = [], weaponChange = {}, assumptions = {} } = setup;
  const attacks = [{ ...baseAttack, ...(setup.damage === undefined ? {} : { damage }) }];
  const library = makeLibrary(modules, { attacks, ...weaponChange });
  const scenario = scenarioWith(modules, mission, setup.build);
  const rifle = must(library.weapons.get('test-rifle'), 'no weapon');
  const fired = must(rifle.attacks[0], 'no attack');

  const collected = collectEffects(scenario, library);
  const selection = selectionOf(rifle, fired);
  const contributions = contributionsTo(collected, library, { selection });
  const composition = composeDamage(rifle, fired, {
    build: scenario.build,
    library,
    contributions,
    totals: sumBuckets(contributions, library),
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...assumptions },
  });
  return { ...composition, warnings: collected.warnings };
};

type Field = 'ratio' | 'quantized' | 'damage';

/** One number per type, rounded to ten digits. */
export const perType = ({ types }: Pick<Composition, 'types'>, field: Field = 'damage') =>
  Object.fromEntries(
    [...types].map(([type, entry]) => [type, Number(entry[field].toPrecision(10))]),
  );

/** The bonuses behind every element. */
export const sourcesOf = ({ elements }: Pick<Composition, 'elements'>) =>
  elements.flatMap(({ parts }) => parts).flatMap(({ sources }) => sources);

export const elementMod = (id: string, element: DamageType, value = 0.9) =>
  mod(id, [add(`damage.element.${element}`, value)]);

export const physicalMod = (id: string, type: DamageType, value: number) =>
  mod(id, [add(`damage.ips.${type}`, value)]);

export const buff = (id: string, element: DamageType, value: number) =>
  mod(id, [add(`damage.elementNoCombine.${element}`, value)], { kind: 'buff' });
