import type { DamageType, ProcRef } from '@abacus/data/schema/damageType';
import type { Layer } from '@abacus/data/schema/damageTypeRule';

import type { Contribution } from '@/build/types';

/** The links of the direct-damage chain (BIBLE §3). A final multiplier has one of its own. */
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
  | 'reduction'
  | 'least';

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
  readonly procs: readonly ProcRef[];
};
