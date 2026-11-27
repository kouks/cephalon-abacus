import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { BuiltAttack } from '@/build/buildAttack';
import type { AttackRates } from '@/build/stats/attackRates';
import type { AttackStats } from '@/build/stats/attackStats';

/** How a firing mode spends its time, in seconds, with the numbers of the closed form (BIBLE §9). */
export type Cycle = {
  /** Before each shot. */
  readonly charge: number;
  /** The shots of a burst, and the time between them: one shot for a weapon that doesn't burst. */
  readonly burst: { readonly count: number; readonly delay: number };
  /** After a shot, or a burst's last: the fire delay. None after a charge that reloads, or needs none. */
  readonly delay: number;
  /** Shots per magazine, which can have a share of one: unlimited when shots cost nothing. */
  readonly magazine: number;
  /** After the magazine's last shot and its delay. */
  readonly reload: number;
  /** The reload starts at the last shot, in place of its delay (Vectis). */
  readonly hidesDelay: boolean;
};

const delayOf = ({ trigger, afterCharge }: Attack, { fireRate }: AttackStats) =>
  trigger === 'charge' && afterCharge !== 'fireDelay' ? 0 : 1 / fireRate.value;

/** A charge that reloads does so after every shot, whatever the magazine: 1 ÷ (charge + reload). */
const magazineOf = ({ afterCharge }: Attack, { shotsPerMagazine }: AttackRates) =>
  afterCharge === 'reload' ? 1 : shotsPerMagazine;

const burstOf = ({ burstCount = 1 }: Attack, { burstDelay }: AttackStats) => ({
  count: burstCount,
  delay: burstDelay?.value ?? 0,
});

type Built = Pick<BuiltAttack, 'attack' | 'stats' | 'rates'>;

export const cycleOf = (weapon: Weapon, { attack, stats, rates }: Built): Cycle => ({
  charge: stats.chargeTime?.value ?? 0,
  burst: burstOf(attack, stats),
  delay: delayOf(attack, stats),
  magazine: magazineOf(attack, rates),
  reload: stats.reloadTime?.value ?? 0,
  hidesDelay: weapon.ammo?.reloadHidesDelay === true,
});
