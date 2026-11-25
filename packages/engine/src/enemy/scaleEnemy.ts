import { must } from '@abacus/data/assert';
import { findCurve } from '@abacus/data/load/findCurve';
import type { Library } from '@abacus/data/load/library';
import type { Enemy } from '@abacus/data/schema/enemy';
import { baseOf } from '@abacus/data/schema/enemy';
import type { ScaledStat, ScalingCurve, ScalingRule } from '@abacus/data/schema/scaling';
import { DEFAULT_MISSION } from '@abacus/data/schema/scaling';
import type { Scenario } from '@abacus/data/schema/scenario';

import { eximusBase } from './eximusBase';
import { f32, growthAt } from './growth';

/** One step from a base stat to the one at a level. */
export type ScalingTerm = {
  readonly name:
    'base' | 'eximusBase' | 'levels' | 'low' | 'high' | 'blend' | 'growth' | 'steelPath' | 'limit';
  readonly value: number;
};

/** A stat, and the terms that made it: base × growth × steelPath, within the limit. */
export type EnemyStat = { readonly value: number; readonly terms: readonly ScalingTerm[] };

/** An enemy's stats at its level (BIBLE §10). */
export type EnemyStats = { readonly level: number } & Readonly<Record<ScaledStat, EnemyStat>>;

/** Where an enemy is met: its level before the Steel Path adds to it. */
export type Met = Pick<Scenario['enemy'], 'level' | 'steelPath' | 'mission'>;

const LEVEL_CAP = 9999;

type SteelPath = Extract<ScalingRule, { kind: 'mission' }>['steelPath'];

const OFF: SteelPath = { levels: 0, health: 1, shield: 1 };

const steelPathOf = ({ steelPath, mission = DEFAULT_MISSION }: Met, { scaling }: Library) => {
  const rule = scaling.get(mission);
  if (rule?.kind !== 'mission') throw new Error(`No mission "${mission}"`);
  return steelPath ? rule.steelPath : OFF;
};

/** What the stats grow from: Eximus units start from more health and shields. */
const startOf = (enemy: Enemy, level: number, { scaling }: Library) => {
  const base = baseOf(enemy);
  if (enemy.flags?.includes('eximus') !== true) return base;
  const rule = [...scaling.values()].find(({ kind }) => kind === 'eximus');
  return rule?.kind === 'eximus' ? { ...base, ...eximusBase(enemy, level, rule) } : base;
};

const within = ({ limits }: ScalingCurve, value: number) =>
  limits === undefined ? value : Math.min(Math.max(value, limits.least), limits.most);

type Stat = {
  readonly base: number;
  readonly start: number;
  readonly curve: ScalingCurve | undefined;
  readonly steelPath: number;
};

const scaleStat = (stat: Stat, levels: { level: number; baseLevel: number }): EnemyStat => {
  const { base, start, steelPath } = stat;
  const terms: ScalingTerm[] = [{ name: 'base', value: base }];
  if (base === 0) return { value: 0, terms };

  const curve = must(stat.curve, 'The loader checks that every stat has a curve');
  const growth = growthAt(curve, levels);
  const scaled = f32(f32(f32(start) * growth.multiplier) * steelPath);
  const value = within(curve, scaled);
  if (start !== base) terms.push({ name: 'eximusBase', value: start });
  terms.push(
    { name: 'levels', value: growth.levels },
    { name: 'low', value: growth.low },
    { name: 'high', value: growth.high },
    { name: 'blend', value: growth.blend },
    { name: 'growth', value: growth.multiplier },
  );
  if (steelPath !== 1) terms.push({ name: 'steelPath', value: steelPath });
  if (value !== scaled) terms.push({ name: 'limit', value });
  return { value, terms };
};

export const scaleEnemy = (enemy: Enemy, met: Met, library: Library): EnemyStats => {
  const steelPath = steelPathOf(met, library);
  const level = Math.min(met.level + steelPath.levels, LEVEL_CAP);
  const base = baseOf(enemy);
  const start = startOf(enemy, level, library);
  const rates = { ...steelPath, armor: 1, overguard: 1 };
  const scale = (stat: ScaledStat) =>
    scaleStat(
      {
        base: base[stat],
        start: start[stat],
        curve: findCurve(stat, enemy.scalingProfile, library),
        steelPath: rates[stat],
      },
      { level, baseLevel: enemy.baseLevel },
    );
  return {
    level,
    health: scale('health'),
    shield: scale('shield'),
    armor: scale('armor'),
    overguard: scale('overguard'),
  };
};

/** The scaled stats of a scenario's enemy. The neutral dummy has none. */
export const enemyStats = (
  { id, ...met }: Scenario['enemy'],
  library: Library,
): EnemyStats | undefined => {
  const enemy = library.enemies.get(id);
  return enemy === undefined ? undefined : scaleEnemy(enemy, met, library);
};
