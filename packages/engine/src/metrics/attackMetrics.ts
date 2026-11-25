import type { Attack } from '@abacus/data/schema/attack';
import type { Scenario } from '@abacus/data/schema/scenario';

import { buildAttack } from '@/build/buildAttack';
import type { Composition } from '@/build/composition/composeDamage';
import type { Loadout } from '@/build/loadout';
import type { AttackRates } from '@/build/stats/attackRates';
import type { AttackStats } from '@/build/stats/attackStats';
import type { ExpectedShot } from '@/resolve/expectedShot';
import { expectedShot } from '@/resolve/expectedShot';
import type { Target } from '@/resolve/target';

import { withLinked } from './firingModes';

/** The four numbers of a firing mode (BIBLE §9). */
export type Headline = {
  /** One shot, with everything it sets off. */
  readonly perShot: number;
  /** Damage per second until the magazine is empty. */
  readonly burstDps: number;
  /** Damage per second with reloads. */
  readonly sustainedDps: number;
  /** With every round the weapon can carry. Infinite when it never runs out. */
  readonly lifetimeDamage: number;
};

export type AttackMetrics = Headline & {
  readonly attackId: string;
  readonly name: string;
  readonly stats: AttackStats;
  readonly rates: AttackRates;
  /** Its damage by type, before and after quantization. */
  readonly composition: Composition;
  /** The shot itself, then those it sets off. */
  readonly shots: readonly { readonly attackId: string; readonly shot: ExpectedShot }[];
};

type Fight = {
  readonly target: Target;
  readonly aim: Scenario['aim'];
  readonly distance: number;
};

/** N × (1 + max ammo ÷ magazine): the loaded magazine, and the rest in reserve. */
const shotsCarried = ({ magazine, maxAmmo }: AttackStats, { shotsPerMagazine }: AttackRates) =>
  magazine === undefined || maxAmmo === undefined
    ? Number.POSITIVE_INFINITY
    : shotsPerMagazine * (1 + maxAmmo.value / magazine.value);

const headline = (perShot: number, stats: AttackStats, rates: AttackRates): Headline => {
  const burstDps = perShot * rates.effectiveFireRate;
  return {
    perShot,
    burstDps,
    sustainedDps: burstDps * rates.shootingProportion,
    lifetimeDamage: perShot === 0 ? 0 : perShot * shotsCarried(stats, rates),
  };
};

/** What a firing mode does to a target on average, in closed form. */
export const attackMetrics = (loadout: Loadout, attack: Attack, fight: Fight): AttackMetrics => {
  const shots = withLinked(attack, loadout.weapon).map((fired) => {
    const buildFor: Parameters<typeof expectedShot>[0]['buildFor'] = (bodyParts) =>
      buildAttack(loadout, fired, { bodyParts });
    return { attackId: fired.id, shot: expectedShot({ buildFor, ...fight }) };
  });
  const perShot = shots.reduce((sum, { shot }) => sum + shot.total, 0);
  const { stats, rates, composition } = buildAttack(loadout, attack);
  const { id: attackId, name } = attack;
  return { attackId, name, ...headline(perShot, stats, rates), stats, rates, composition, shots };
};
