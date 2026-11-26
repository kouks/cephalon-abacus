import type { Library } from '@abacus/data/load/library';
import type { Scenario } from '@abacus/data/schema/scenario';

import type { Assumptions } from '@/assumptions';
import type { BuildMetrics } from '@/metrics/buildMetrics';
import { buildMetrics } from '@/metrics/buildMetrics';

export type { Assumptions } from '@/assumptions';
export type { Contribution, Warning } from '@/build/types';
export type { EnemyStat, EnemyStats, ScalingTerm } from '@/enemy/scaleEnemy';
export type { AttackMetrics } from '@/metrics/attackMetrics';
export type { Dealt, LayersLeft } from '@/resolve/applyHit';
export type { TierDealt } from '@/resolve/dealtOnLayers';
export type { HitResult } from '@/resolve/resolveHit';
export type { Factor, HitTrace } from '@/trace/hitTrace';

/** Goes up when a Scenario or a Result changes in a way that breaks what reads or writes it. */
export const API_VERSION = 1;

/** Plain data: it can be cloned to and from a Worker. */
export type Result = BuildMetrics & { readonly apiVersion: typeof API_VERSION };

type Options = { readonly assumptions?: Partial<Assumptions> };

/** What a build does on average, in closed form (BIBLE §9). Throws if there is no such weapon or enemy. */
export const evaluate = (
  scenario: Scenario,
  library: Library,
  { assumptions = {} }: Options = {},
): Result => ({ apiVersion: API_VERSION, ...buildMetrics(scenario, library, assumptions) });
