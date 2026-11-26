import type { Bucket } from '@/schema/bucket';
import type { DamageType } from '@/schema/damageType';
import type { DamageTypeRule } from '@/schema/damageTypeRule';
import type { Enemy } from '@/schema/enemy';
import type { Faction } from '@/schema/faction';
import type { Module } from '@/schema/module';
import type { ScalingRule } from '@/schema/scaling';
import type { Status } from '@/schema/status';
import type { Weapon } from '@/schema/weapon';

/** The game rules that change between updates, by id. */
export type Reference = {
  readonly damageTypes: ReadonlyMap<DamageType, DamageTypeRule>;
  readonly buckets: ReadonlyMap<string, Bucket>;
  readonly factions: ReadonlyMap<string, Faction>;
  readonly scaling: ReadonlyMap<string, ScalingRule>;
  /** Status effects by the `proc` slug that names them. */
  readonly statuses: ReadonlyMap<string, Status>;
};

/** Everything the engine reads, by id. */
export type Library = Reference & {
  readonly weapons: ReadonlyMap<string, Weapon>;
  readonly modules: ReadonlyMap<string, Module>;
  readonly enemies: ReadonlyMap<string, Enemy>;
};
