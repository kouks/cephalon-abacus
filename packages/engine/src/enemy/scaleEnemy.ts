import { must } from '@abacus/data/assert';
import { findCurve } from '@abacus/data/load/findCurve';
import type { Library } from '@abacus/data/load/library';
import type { Enemy } from '@abacus/data/schema/enemy';
import { baseOf } from '@abacus/data/schema/enemy';
import type { ScaledStat, ScalingCurve } from '@abacus/data/schema/scaling';
import type { Scenario } from '@abacus/data/schema/scenario';

import { eximusBase } from './eximusBase';
import { f32, growthAt } from './growth';

/** One step from a base stat to the one at a level. */
export type ScalingTerm = {
  readonly name:
    | 'base'
    | 'eximusBase'
    | 'levels'
    | 'low'
    | 'high'
    | 'blend'
    | 'growth'
    | 'steelPath'
    | 'limit'
    | 'whole';
  readonly value: number;
};

/** A stat, and the terms that made it: base × growth × steelPath, within the limit. */
export type EnemyStat = {
  readonly value: number;
  readonly terms: readonly ScalingTerm[];
  /** What it would be above its highest limit, where that limit lowered it: armor over 2,700. */
  readonly uncapped?: number;
};

/** An enemy's stats at its level (BIBLE §10). */
export type EnemyStats = { readonly level: number } & Readonly<Record<ScaledStat, EnemyStat>>;

/** How an enemy is met. Its level is the one it has, on the Steel Path too. */
export type Met = Pick<Scenario['enemy'], 'level' | 'steelPath'>;

const PLAIN: Readonly<Record<ScaledStat, number>> = {
  health: 1,
  shield: 1,
  armor: 1,
  overguard: 1,
};

/** What the Steel Path multiplies each stat by. */
const ratesOf = ({ steelPath }: Met, { scaling }: Library) => {
  const rule = [...scaling.values()].find(({ kind }) => kind === 'steelPath');
  if (!steelPath || rule?.kind !== 'steelPath') return PLAIN;
  return { ...PLAIN, health: rule.health, shield: rule.shield };
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

/** Whether the game keeps a stat as a whole number (T-46). */
const isWhole = (stat: ScaledStat, { scaling }: Library) =>
  [...scaling.values()].some((rule) => rule.kind === 'whole' && rule.stats.includes(stat));

type Stat = {
  readonly base: number;
  readonly start: number;
  readonly curve: ScalingCurve | undefined;
  readonly steelPath: number;
  readonly isWhole: boolean;
};

const scaleStat = (stat: Stat, levels: { level: number; baseLevel: number }): EnemyStat => {
  const { base, start, steelPath } = stat;
  const terms: ScalingTerm[] = [{ name: 'base', value: base }];
  if (base === 0) return { value: 0, terms };

  const curve = must(stat.curve, 'The loader checks that every stat has a curve');
  const growth = growthAt(curve, levels);
  const scaled = f32(f32(f32(start) * growth.multiplier) * steelPath);
  const limited = within(curve, scaled);
  const value = stat.isWhole ? Math.round(limited) : limited;
  if (start !== base) terms.push({ name: 'eximusBase', value: start });
  terms.push(
    { name: 'levels', value: growth.levels },
    { name: 'low', value: growth.low },
    { name: 'high', value: growth.high },
    { name: 'blend', value: growth.blend },
    { name: 'growth', value: growth.multiplier },
  );
  if (steelPath !== 1) terms.push({ name: 'steelPath', value: steelPath });
  if (limited !== scaled) terms.push({ name: 'limit', value: limited });
  if (value !== limited) terms.push({ name: 'whole', value });
  return scaled > limited ? { value, terms, uncapped: scaled } : { value, terms };
};

export const scaleEnemy = (enemy: Enemy, met: Met, library: Library): EnemyStats => {
  const { level } = met;
  const rates = ratesOf(met, library);
  const base = baseOf(enemy);
  const start = startOf(enemy, level, library);
  const scale = (stat: ScaledStat) =>
    scaleStat(
      {
        base: base[stat],
        start: start[stat],
        curve: findCurve(stat, enemy.scalingProfile, library),
        steelPath: rates[stat],
        isWhole: isWhole(stat, library),
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
