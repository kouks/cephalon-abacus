import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import { formatError } from '#data/load/libraryError.ts';
import { loadLibrary } from '#data/load/loadLibrary.ts';
import type { Attack } from '#data/schema/attack.ts';
import { attackTriggerSchema } from '#data/schema/attack.ts';
import type { Weapon } from '#data/schema/weapon.ts';

import { readLibrary } from './readLibrary.ts';

const result = loadLibrary(readLibrary());
if (!result.ok) throw new Error(result.errors.map(formatError).join('\n'));
const weapons = [...result.library.weapons.values()];

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

const totalOf = ({ damage }: Attack) => Number(sum(Object.values(damage)).toFixed(2));

const percent = (share: number) => `${Number((share * 100).toFixed(2))}%`;

/** An attack as the arsenal and the wiki's infobox show it, unmodded and per pellet. */
const describeAttack = (attack: Attack) => {
  const { trigger, critChance, critMultiplier, statusChance, fireRate, multishot } = attack;
  const types = Object.entries(attack.damage).map(([type, amount]) => `${type} ${amount}`);
  const rate = Number(fireRate.toFixed(2));
  return [
    trigger,
    `${totalOf(attack)} (${types.join(', ')})${multishot === 1 ? '' : ` x${multishot}`}`,
    `crit ${percent(critChance)} ${critMultiplier}x`,
    `status ${percent(statusChance)}`,
    `${rate}/s`,
  ].join(' | ');
};

const describeAmmo = ({ ammo }: Weapon) =>
  ammo?.reloadStyle === 'magazine'
    ? `${ammo.magazine} / ${ammo.maxAmmo ?? '-'}, ${ammo.reloadTime} s`
    : '-';

const rowsOf = (weapon: Weapon) =>
  weapon.attacks.map(
    (attack) =>
      `${weapon.name}, ${attack.name}: ${describeAttack(attack)} | ${describeAmmo(weapon)}`,
  );

const SHOWN = new Set([
  'id',
  'name',
  'damage',
  'trigger',
  'shotType',
  'multishot',
  'critChance',
  'critMultiplier',
  'statusChance',
  'fireRate',
]);

/** What the arsenal doesn't show: timing, geometry, procs and flags. */
const describeRest = (attack: Attack) => {
  const rest = Object.entries(attack).filter(([key]) => !SHOWN.has(key));
  return `${attack.shotType} ${JSON.stringify(Object.fromEntries(rest)).replaceAll('"', '')}`;
};

const restOf = (weapon: Weapon) =>
  weapon.attacks.map((attack) => `${weapon.name}, ${attack.name}: ${describeRest(attack)}`);

const describeWhole = ({ id, slot, class: classes, compatTags, zoomLevels = [] }: Weapon) => {
  const zooms = zoomLevels.map(({ zoom, effects }) => `${zoom}x ${JSON.stringify(effects)}`);
  return [id, slot, classes, compatTags ?? [], zooms].join(' | ').replaceAll('"', '');
};

const attacks = weapons.flatMap((weapon) => weapon.attacks);

const find = (id: string) => must(result.library.weapons.get(id), `No weapon "${id}"`);

describe('the seed weapons', () => {
  it('have the unmodded stats of the wiki', () => {
    expect(weapons.flatMap(rowsOf)).toMatchInlineSnapshot(`
      [
        "Braton, Normal Attack: auto | 24 (impact 7.92, puncture 7.92, slash 8.16) | crit 12% 1.6x | status 6% | 8.75/s | 45 / 540, 2 s",
        "Soma Prime, Fully Spooled: autoSpool | 12 (impact 1.2, puncture 4.8, slash 6) | crit 30% 3x | status 10% | 15/s | 200 / 800, 3 s",
        "Tigris Prime, Normal Attack: duplex | 195 (impact 19.5, puncture 19.5, slash 156) x8 | crit 10% 2x | status 11.25% | 2/s | 2 / 120, 1.8 s",
        "Vectis Prime, Normal Attack: semi | 350 (impact 140, puncture 157.5, slash 52.5) | crit 30% 2x | status 30% | 2.67/s | 2 / 72, 0.85 s",
        "Paris Prime, Uncharged Shot: semi | 180 (impact 9, puncture 153, slash 18) | crit 45% 2x | status 20% | 1/s | 1 / 72, 0.7 s",
        "Paris Prime, Charged Shot: charge | 360 (impact 9, puncture 288, slash 63) | crit 45% 2x | status 20% | 1/s | 1 / 72, 0.7 s",
        "Burston, Normal Attack: burst | 30 (impact 10, puncture 10, slash 10) | crit 6% 1.6x | status 18% | 5/s | 45 / 540, 2 s",
        "Amprex, Normal Attack: held | 22 (electricity 22) | crit 32% 2.2x | status 22% | 12/s | 100 / 700, 2.6 s",
        "Penta, Grenade Impact: active | 75 (impact 75) | crit 10% 2x | status 10% | 1/s | 5 / 20, 2.5 s",
        "Penta, Grenade Detonation: active | 350 (blast 350) | crit 10% 2x | status 10% | 1/s | 5 / 20, 2.5 s",
        "Nagantaka Prime, Semi-Auto: semi | 173 (impact 1.73, puncture 15.57, slash 155.7) | crit 25% 2.3x | status 39% | 2.5/s | 11 / 540, 2.3 s",
        "Lex, Normal Attack: semi | 130 (impact 13, puncture 104, slash 13) | crit 20% 2x | status 10% | 1.08/s | 6 / 210, 2.35 s",
        "Kuva Nukor, Normal Attack: held | 21 (radiation 21) | crit 7% 5x | status 50% | 10/s | 77 / 210, 2 s",
      ]
    `);
  });

  it('have the timing and geometry of the wiki', () => {
    expect(weapons.flatMap(restOf)).toMatchInlineSnapshot(`
      [
        "Braton, Normal Attack: hitscan {ammoCost:1,range:300,flags:[canHeadshot,canCrit]}",
        "Soma Prime, Fully Spooled: hitscan {ammoCost:1,spool:{shotsToMax:4,startRate:0.25},range:300,flags:[canHeadshot,canCrit]}",
        "Tigris Prime, Normal Attack: hitscan {ammoCost:1,falloff:{start:10,end:20,minPct:0.5128},range:300,flags:[canHeadshot,canCrit]}",
        "Vectis Prime, Normal Attack: hitscan {ammoCost:1,falloff:{start:400,end:600,minPct:0.5},punchThrough:1,range:1000,flags:[canHeadshot,canCrit]}",
        "Paris Prime, Uncharged Shot: projectile {ammoCost:1,projectileSpeed:70,flags:[canHeadshot,canCrit]}",
        "Paris Prime, Charged Shot: projectile {ammoCost:1,chargeTime:0.5,punchThrough:3,projectileSpeed:95,flags:[canHeadshot,canCrit]}",
        "Burston, Normal Attack: hitscan {ammoCost:1,burstCount:3,burstDelay:0.061,range:300,flags:[canHeadshot,canCrit]}",
        "Amprex, Normal Attack: continuous {ammoCost:0.5,beam:{rampStartPct:0.3,rampTime:0.6,decayDelay:0.8,decayTime:2,chain:{targets:3,range:10}},range:18,flags:[canHeadshot,canCrit,mergeMultishotHits]}",
        "Penta, Grenade Impact: projectile {ammoCost:1,projectileSpeed:20,linkedAttacks:[grenade-detonation],flags:[canHeadshot,canCrit]}",
        "Penta, Grenade Detonation: aoe {ammoCost:0,aoe:{radius:4,centerPct:1,edgePct:0.5,losRequired:false},flags:[canCrit,isAoE]}",
        "Nagantaka Prime, Semi-Auto: projectile {ammoCost:1,projectileSpeed:100,forcedProcs:[{type:impact,count:1}],flags:[canHeadshot,canCrit]}",
        "Lex, Normal Attack: hitscan {ammoCost:1,range:300,flags:[canHeadshot,canCrit]}",
        "Kuva Nukor, Normal Attack: continuous {ammoCost:1,beam:{rampStartPct:0.3,rampTime:0.6,decayDelay:0.8,decayTime:2,chain:{targets:2,range:9}},range:29,flags:[canHeadshot,canCrit,mergeMultishotHits]}",
      ]
    `);
  });

  it('carry what applies to the whole weapon', () => {
    expect(weapons.map(describeWhole)).toMatchInlineSnapshot(`
      [
        "braton | primary | rifle | ASSAULT_AMMO | ",
        "soma-prime | primary | rifle | ASSAULT_AMMO | ",
        "tigris-prime | primary | shotgun | SINGLESHOT | ",
        "vectis-prime | primary | sniper | SNIPER_AMMO,SINGLESHOT | 3.5x [{bucket:headshot.damage,op:STACKING_MULTIPLY,value:0.4,filter:{bodyPart:head}}],6x [{bucket:headshot.damage,op:STACKING_MULTIPLY,value:0.6,filter:{bodyPart:head}}]",
        "paris-prime | primary | bow | PROJECTILE | ",
        "burston | primary | rifle | ASSAULT_AMMO | ",
        "amprex | primary | rifle | BEAM,ASSAULT_AMMO,AOE | ",
        "penta | primary | launcher | PROJECTILE,AOE,SINGLESHOT | ",
        "nagantaka-prime | primary | crossbow | PROJECTILE,ZHUGE,CROSSBOW | ",
        "lex | secondary | pistol |  | ",
        "kuva-nukor | secondary | pistol | BEAM | ",
      ]
    `);
  });

  it('cover every trigger', () => {
    const triggers = attacks.map(({ trigger }) => trigger);
    expect(new Set(triggers)).toEqual(new Set(attackTriggerSchema.options));
  });

  it('cover every shot type', () => {
    const shots = attacks.map(({ shotType }) => shotType);
    expect(new Set(shots)).toEqual(new Set(['hitscan', 'projectile', 'aoe', 'continuous']));
  });

  it('come from the official wiki', () => {
    for (const { source } of weapons) expect(source).toMatch(/^https:\/\/wiki\.warframe\.com\/w\//);
  });

  it('have a progenitor weapon, a sniper and an explosion of its own', () => {
    expect(find('kuva-nukor').progenitor).toBeDefined();
    expect(find('kuva-nukor').maxRank).toBe(40);
    expect(find('vectis-prime').sniperCombo).toEqual({ minHits: 5, reset: 2 });
    expect(find('penta').attacks[0]?.linkedAttacks).toEqual(['grenade-detonation']);
  });

  it('have a damage type too small to survive quantization (T-2, T-14)', () => {
    const { damage } = must(find('nagantaka-prime').attacks[0], 'no attack');
    expect((damage.impact ?? 0) / sum(Object.values(damage))).toBeCloseTo(0.01, 12);
  });
});
