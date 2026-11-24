import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Assumptions } from '@/assumptions';
import type { BucketTotals } from '@/build/totalBuckets';

import { fireRateTotal, modBurstDelay, modChargeTime, modFireRate } from './fireRate';
import type { ModdedStat } from './moddedStat';
import { modStat, modTime, totalIn } from './moddedStat';

/** An attack's stats with the build applied (BIBLE §3, step 3). Crit and status are still raw. */
export type AttackStats = {
  readonly critChance: ModdedStat;
  readonly critMultiplier: ModdedStat;
  readonly statusChance: ModdedStat;
  readonly statusDuration: ModdedStat;
  readonly multishot: ModdedStat;
  readonly punchThrough: ModdedStat;
  readonly fireRate: ModdedStat;
  readonly ammoEfficiency: ModdedStat;
  readonly chargeTime?: ModdedStat;
  readonly burstDelay?: ModdedStat;
  readonly range?: ModdedStat;
  readonly projectileSpeed?: ModdedStat;
  readonly aoeRadius?: ModdedStat;
  readonly magazine?: ModdedStat;
  readonly maxAmmo?: ModdedStat;
  readonly reloadTime?: ModdedStat;
};

type Optional = Partial<Record<'range' | 'projectileSpeed' | 'aoeRadius', number | undefined>>;

/** Stats the attack may not have: absent stays absent. */
const modGeometry = (attack: Attack, totals: BucketTotals) => {
  const { range, projectileSpeed, aoe } = attack;
  const bases: Optional = { range, projectileSpeed, aoeRadius: aoe?.radius };
  return Object.fromEntries(
    Object.entries(bases).flatMap(([bucket, base]) =>
      base === undefined ? [] : [[bucket, modStat(totals, base, [bucket])]],
    ),
  );
};

/** What emptying the magazine costs, before reload speed. */
const reloadBase = (ammo: NonNullable<Weapon['ammo']>, magazine: number) =>
  ammo.reloadStyle === 'battery' ? ammo.regenDelay + magazine / ammo.regenRate : ammo.reloadTime;

const modAmmo = ({ ammo }: Weapon, totals: BucketTotals) => {
  if (ammo === undefined) return {};
  const magazine = modStat(totals, ammo.magazine, ['magazine']);
  const reload = reloadBase(ammo, magazine.value);
  return {
    magazine,
    reloadTime: modTime(reload, totalIn(totals, 'reload')),
    ...(ammo.maxAmmo === undefined ? {} : { maxAmmo: modStat(totals, ammo.maxAmmo, ['ammoMax']) }),
  };
};

const modTiming = (attack: Attack, weapon: Weapon, { totals, assumptions }: Build) => {
  const total = fireRateTotal(totals, weapon, assumptions);
  const { chargeTime, burstDelay } = attack;
  return {
    fireRate: modFireRate(attack, total),
    ...(chargeTime === undefined ? {} : { chargeTime: modChargeTime(chargeTime, total) }),
    ...(burstDelay === undefined ? {} : { burstDelay: modBurstDelay(burstDelay, total) }),
  };
};

/** The bucket totals of the attack, and the rules to read them by. */
export type Build = { readonly totals: BucketTotals; readonly assumptions: Assumptions };

export const attackStats = (weapon: Weapon, attack: Attack, build: Build): AttackStats => {
  const { totals } = build;
  return {
    critChance: modStat(totals, attack.critChance, ['crit.chance']),
    critMultiplier: modStat(totals, attack.critMultiplier, ['crit.damage']),
    statusChance: modStat(totals, attack.statusChance, ['status.chance', 'status.chanceFlat']),
    statusDuration: modStat(totals, 1, ['status.duration']),
    multishot: modStat(totals, attack.multishot, ['multishot']),
    punchThrough: modStat(totals, attack.punchThrough ?? 0, ['punchThrough']),
    ammoEfficiency: modStat(totals, 0, ['ammoEfficiency']),
    ...modTiming(attack, weapon, build),
    ...modGeometry(attack, totals),
    ...modAmmo(weapon, totals),
  };
};
