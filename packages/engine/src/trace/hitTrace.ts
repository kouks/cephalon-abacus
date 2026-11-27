import type { DamageType } from '@abacus/data/schema/damageType';
import type { Layer } from '@abacus/data/schema/damageTypeRule';
import type { Proc } from '@abacus/data/schema/status';

import type { Contribution } from '@/build/types';

/** The links of the direct-damage chain (BIBLE §3), and of a DoT tick's (§8). A final multiplier has one of its own. */
export type FactorName =
  | 'base'
  | 'share'
  | 'faction'
  | `final.${string}`
  | 'crit'
  | 'bodyPart'
  | 'range'
  | 'falloff'
  | 'landing'
  | 'radialFalloff'
  | 'vulnerability'
  | 'layer'
  | 'armor'
  | 'amplifier'
  | 'reduction'
  | 'least'
  | 'seed'
  | 'coefficient'
  | 'element'
  | 'statusDamage';

/** One multiplier of a hit. */
export type Factor = {
  readonly name: FactorName;
  /** The damage type it is for. Absent: all of them. */
  readonly type?: DamageType;
  readonly value: number;
  /** The bonuses that made it. */
  readonly effects: readonly Contribution[];
};

/** What one hit did, and every factor that made it (BIBLE §15). */
export type HitTrace = {
  /** Simulated seconds. */
  readonly t: number;
  readonly pellet: number;
  /** In the order of the chain. A type's damage is the product of the factors for it. */
  readonly factors: readonly Factor[];
  readonly perType: ReadonlyMap<DamageType, number>;
  readonly layer: Layer;
  /** The armor on the enemy's health, after strips. Absent on the neutral dummy. */
  readonly armor?: number;
  /** The statuses the hit inflicts: shares in expected value. */
  readonly procs: readonly Proc[];
  /** The DoT procs among them, once for each crit tier the hit can be of. */
  readonly dots: readonly DotTrace[];
};

/** One crit tier of a DoT proc a hit inflicts: its seed, its tick, and when it ticks (BIBLE §8). */
export type DotTrace = {
  readonly status: string;
  /** How much of a proc it is: a share in expected value. */
  readonly count: number;
  readonly tier: number;
  /** How likely the hit is to be of the tier. */
  readonly chance: number;
  readonly seed: number;
  /** In the order of the tick formula. A tick is their product. */
  readonly factors: readonly Factor[];
  /** One tick, not rounded. */
  readonly damage: number;
  /** The seconds after the hit that it ticks. */
  readonly times: readonly number[];
};
