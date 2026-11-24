import { must } from '@abacus/data/assert';
import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { AttackStats } from './attackStats';

/** How fast an attack is really used (BIBLE §9). */
export type AttackRates = {
  /** Shots per second while there is ammo. A burst counts each of its shots. */
  readonly effectiveFireRate: number;
  /** Unlimited when shots cost nothing. */
  readonly shotsPerMagazine: number;
  /** The share of the time spent shooting rather than reloading. */
  readonly shootingProportion: number;
};

const chargedRate = ({ afterCharge }: Attack, stats: AttackStats) => {
  const charge = must(stats.chargeTime, 'The schema requires a charge time').value;
  if (afterCharge === 'none') return 1 / charge;
  if (afterCharge === 'fireDelay') return 1 / (charge + 1 / stats.fireRate.value);
  return 1 / (charge + must(stats.reloadTime, 'A bow has ammo').value);
};

/** count ÷ (1 ÷ fire rate + (count − 1) × delay). T-17 confirms count − 1. */
const burstRate = ({ burstCount }: Attack, stats: AttackStats) => {
  const count = must(burstCount, 'The schema requires a burst count');
  const delay = must(stats.burstDelay, 'The schema requires a burst delay').value;
  return count / (1 / stats.fireRate.value + (count - 1) * delay);
};

const effectiveFireRate = (attack: Attack, stats: AttackStats) => {
  if (attack.trigger === 'charge') return chargedRate(attack, stats);
  if (attack.trigger === 'burst') return burstRate(attack, stats);
  return stats.fireRate.value;
};

const shotsPerMagazine = ({ ammoCost }: Attack, { magazine, ammoEfficiency }: AttackStats) => {
  const cost = ammoCost * (1 - ammoEfficiency.value);
  return magazine === undefined || cost === 0 ? Number.POSITIVE_INFINITY : magazine.value / cost;
};

/** N ÷ (N + rate × reload), where a reload that hides the last delay takes one off N below. */
const proportion = (shots: number, reloadShots: number, hidesDelay: boolean) =>
  Number.isFinite(shots) ? shots / (shots - (hidesDelay ? 1 : 0) + reloadShots) : 1;

export const attackRates = (weapon: Weapon, attack: Attack, stats: AttackStats): AttackRates => {
  const rate = effectiveFireRate(attack, stats);
  const shots = shotsPerMagazine(attack, stats);
  // A bow's rate already includes its reload.
  const reload = attack.afterCharge === 'reload' ? 0 : (stats.reloadTime?.value ?? 0);
  const hidesDelay = weapon.ammo?.reloadHidesDelay === true;
  return {
    effectiveFireRate: rate,
    shotsPerMagazine: shots,
    shootingProportion: proportion(shots, rate * reload, hidesDelay),
  };
};
