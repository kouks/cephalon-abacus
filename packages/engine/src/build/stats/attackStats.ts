import type { Attack } from '@abacus/data/schema/attack';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { Assumptions } from '@/assumptions';
import type { BucketTotals } from '@/build/totalBuckets';

import { modCritChance } from './critChance';
import type { CritMultiplier } from './critMultiplier';
import { modCritMultiplier } from './critMultiplier';
import { fireRateTotal, modBurstDelay, modChargeTime, modFireRate } from './fireRate';
import type { ModdedStat } from './moddedStat';
import { modStat, modTime, totalIn } from './moddedStat';

/** An attack's stats with the build applied (BIBLE §3, step 3). Status is still raw. */
export type AttackStats = {
  readonly critChance: ModdedStat;
  readonly critMultiplier: CritMultiplier;
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

/** A projectile with a range flies for a fixed time, so only speed takes it further (BIBLE §11). */
const rangeBucket = ({ shotType }: Attack) =>
  shotType === 'projectile' ? 'projectileSpeed' : 'range';

/** Stats the attack may not have: absent stays absent. */
const modGeometry = (attack: Attack, totals: BucketTotals) => {
  const { range, projectileSpeed, aoe } = attack;
  const stats = [
    ['range', range, rangeBucket(attack)],
    ['projectileSpeed', projectileSpeed, 'projectileSpeed'],
    ['aoeRadius', aoe?.radius, 'aoeRadius'],
  ] as const;
  return Object.fromEntries(
    stats.flatMap(([stat, base, bucket]) =>
      base === undefined ? [] : [[stat, modStat(totals, base, [bucket])]],
    ),
  );
};

/** What emptying the magazine costs, before reload speed. */
const reloadBase = (ammo: NonNullable<Weapon['ammo']>, magazine: number) =>
  ammo.reloadStyle === 'battery' ? ammo.regenDelay + magazine / ammo.regenRate : ammo.reloadTime;

/**
 * Whole rounds, to the nearest, and at least one. The game multiplies in 32 bits, where 45 × 1.3 is
 * 58.499996: Braton with Magazine Warp has 58 rounds (BIBLE §9).
 */
const modMagazine = (base: number, totals: BucketTotals): ModdedStat => {
  const magazine = modStat(totals, base, ['magazine']);
  const inGame = Math.fround(base * Math.fround(magazine.value / base));
  return { ...magazine, value: Math.max(Math.round(inGame), 1) };
};

const modAmmo = ({ ammo }: Weapon, totals: BucketTotals) => {
  if (ammo === undefined) return {};
  const magazine = modMagazine(ammo.magazine, totals);
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
export type Build = {
  readonly totals: BucketTotals;
  /** The totals for its procs, which status duration is scoped to (buckets.json). */
  readonly procTotals: BucketTotals;
  readonly assumptions: Assumptions;
};

export const attackStats = (weapon: Weapon, attack: Attack, build: Build): AttackStats => {
  const { totals } = build;
  return {
    critChance: modCritChance(attack, totals),
    critMultiplier: modCritMultiplier(attack, build),
    statusChance: modStat(totals, attack.statusChance, ['status.chance', 'status.chanceFlat']),
    statusDuration: modStat(build.procTotals, 1, ['status.duration']),
    multishot: modStat(totals, attack.multishot, ['multishot']),
    punchThrough: modStat(totals, attack.punchThrough ?? 0, ['punchThrough']),
    ammoEfficiency: modStat(totals, 0, ['ammoEfficiency']),
    ...modTiming(attack, weapon, build),
    ...modGeometry(attack, totals),
    ...modAmmo(weapon, totals),
  };
};
