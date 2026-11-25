import { describe, expect, it } from 'vitest';

import { add, mod, SERRATION } from '@/testing/build';
import { attackOf, BLAST, GRENADE, measureBuild } from '@/testing/metrics';

const HIT = 103.125;
const ON_HEAD = { scenario: { aim: { head: 1, body: 0 } } };

describe('a build’s metrics', () => {
  it('are per shot, per second with and without reloads, and per all its ammo', () => {
    const { perShot, burstDps, sustainedDps, lifetimeDamage } = measureBuild();
    expect(perShot).toBeCloseTo(HIT, 9);
    expect(burstDps).toBeCloseTo(HIT * 8, 9);
    expect(sustainedDps).toBeCloseTo(HIT * 8 * (45 / (45 + 8 * 2)), 9);
    expect(lifetimeDamage).toBeCloseTo(HIT * 45 * (1 + 540 / 45), 9);
  });

  it('follow the mods: Serration and +100% magazine', () => {
    const magazine = mod('magazine', [add('magazine', 1)]);
    const { perShot, sustainedDps, lifetimeDamage } = measureBuild({
      modules: [SERRATION, magazine],
    });
    expect(perShot).toBeCloseTo(HIT * 2.65, 9);
    expect(sustainedDps).toBeCloseTo(HIT * 2.65 * 8 * (90 / (90 + 16)), 9);
    expect(lifetimeDamage).toBeCloseTo(HIT * 2.65 * (90 + 540), 8);
  });

  it('count every pellet', () => {
    const attacks = [attackOf('shotgun', { multishot: 8 })];
    const split = mod('split', [add('multishot', 0.5)]);
    expect(measureBuild({ attacks, modules: [split] }).perShot).toBeCloseTo(12 * HIT, 9);
  });

  it('use more ammo per shot, or less', () => {
    const half = measureBuild({ attacks: [attackOf('beam', { ammoCost: 0.5 })] });
    expect(half.lifetimeDamage).toBeCloseTo(HIT * 2 * 585, 8);
    const efficient = mod('efficient', [add('ammoEfficiency', 0.75, { op: 'ADD' })]);
    expect(measureBuild({ modules: [efficient] }).lifetimeDamage).toBeCloseTo(HIT * 4 * 585, 8);
  });

  it('have the traces of the shot’s hits', () => {
    const { trace } = measureBuild({ scenario: { aim: { head: 0.5, body: 0.5 } } });
    expect(trace).toHaveLength(2);
    const parts = trace
      .flatMap(({ factors }) => factors)
      .filter(({ name }) => name === 'bodyPart')
      .map(({ value }) => value);
    expect(parts).toEqual([3, 1]);
  });

  it('are for the scenario’s distance', () => {
    const attacks = [attackOf('shotgun', { falloff: { start: 10, end: 20, minPct: 0.5 } })];
    const at = (distance: number) => measureBuild({ attacks, scenario: { distance } });
    expect(at(10).perShot).toBeCloseTo(HIT, 9);
    expect(at(12).perShot).toBeCloseTo(HIT * 0.8, 9);
    expect(at(12).warnings).toEqual([]);
  });

  it('take other assumptions', () => {
    const attacks = [attackOf('normal', { critChance: 1, flags: ['canCrit', 'canHeadshot'] })];
    const modules = [mod('vital-sense', [add('crit.damage', 1.2)])];
    const onHead = { attacks, modules, ...ON_HEAD };
    const assumptions = { headcritScalesModded: false };
    const ratio = measureBuild({ ...onHead, assumptions }).perShot / measureBuild(onHead).perShot;
    expect(ratio).toBeCloseTo(3.2 / 4.4, 9);
  });

  it('keep the stats and rates they came from', () => {
    const [normal] = measureBuild().byAttack;
    expect(normal?.name).toBe('normal');
    expect(normal?.rates.shotsPerMagazine).toBe(45);
    expect(normal?.stats.maxAmmo?.value).toBe(540);
  });
});

describe('lifetime damage', () => {
  it('is infinite without a limit to the ammo', () => {
    const ammo = { magazine: 45, reloadStyle: 'magazine', reloadTime: 2 };
    expect(measureBuild({ weaponChange: { ammo } }).lifetimeDamage).toBe(Infinity);
    const free = measureBuild({ attacks: [attackOf('free', { ammoCost: 0 })] });
    expect(free.lifetimeDamage).toBe(Infinity);
    expect(free.sustainedDps).toBeCloseTo(free.burstDps, 9);
  });

  it('is zero for a weapon that does nothing, however much ammo it has', () => {
    const riven = mod('riven', [add('damage.base', -1.5)]);
    const attacks = [attackOf('free', { ammoCost: 0 })];
    expect(measureBuild({ attacks, modules: [riven] }).lifetimeDamage).toBe(0);
  });
});

describe('an attack that sets off another', () => {
  it('adds it to every shot, at its own rate', () => {
    const { byAttack, perShot, burstDps, trace } = measureBuild({ attacks: [GRENADE, BLAST] });
    expect(byAttack.map(({ attackId }) => attackId)).toEqual(['grenade']);
    expect(perShot).toBeCloseTo(75 + 350, 9);
    expect(burstDps).toBeCloseTo(425 * 8, 9);
    expect(byAttack[0]?.shots.map(({ attackId }) => attackId)).toEqual(['grenade', 'blast']);
    expect(trace).toHaveLength(2);
  });

  it('counts an explosion per pellet', () => {
    const split = mod('split', [add('multishot', 1)]);
    const { perShot } = measureBuild({ attacks: [GRENADE, BLAST], modules: [split] });
    expect(perShot).toBeCloseTo(2 * 425, 9);
  });

  it('gives the explosion no headshot', () => {
    const { perShot } = measureBuild({ attacks: [GRENADE, BLAST], ...ON_HEAD });
    expect(perShot).toBeCloseTo(3 * 75 + 350, 9);
  });

  it('gives the explosion no bonus for direct hits only, such as GunCO', () => {
    const aptitude = mod('aptitude', [add('damage.base', 1, { scope: ['direct'] })]);
    const { perShot } = measureBuild({ attacks: [GRENADE, BLAST], modules: [aptitude] });
    expect(perShot).toBeCloseTo(2 * 75 + 350, 9);
  });

  it('sets off nothing where it doesn’t reach', () => {
    const attacks = [{ ...GRENADE, range: 20 }, BLAST];
    const [near, far] = [20, 21].map((distance) =>
      measureBuild({ attacks, scenario: { distance } }),
    );
    expect(near?.perShot).toBeCloseTo(75 + 350, 9);
    expect([far?.perShot, far?.lifetimeDamage, far?.sustainedDps]).toEqual([0, 0, 0]);
    const ranges = far?.trace
      .flatMap(({ factors }) => factors)
      .filter(({ name }) => name === 'range')
      .map(({ value }) => value);
    expect(ranges).toEqual([0, 0]);
  });

  it('reaches a target it lands beside with the explosion alone', () => {
    const aim = { head: 1, body: 0, missBy: 3 };
    const { perShot, byAttack, warnings } = measureBuild({
      attacks: [GRENADE, BLAST],
      scenario: { aim },
    });
    expect(perShot).toBeCloseTo(175, 9);
    expect(byAttack[0]?.shots.map(({ shot }) => shot.total)).toEqual([0, expect.closeTo(175, 9)]);
    expect(warnings).toEqual([]);
  });

  it('says how wide it explodes', () => {
    const firestorm = mod('firestorm', [add('aoeRadius', 0.24)]);
    const { byAttack } = measureBuild({ attacks: [GRENADE, BLAST], modules: [firestorm] });
    const radii = byAttack[0]?.shots.map(({ shot }) => shot.stats.aoeRadius?.value);
    expect(radii).toEqual([undefined, expect.closeTo(4.96, 9)]);
  });

  it('crits only where each can', () => {
    const avenger = mod('avenger', [add('crit.chanceFlat', 1, { op: 'ADD' })]);
    const explosive = { ...BLAST, flags: ['isAoE', 'canCrit'] };
    const { perShot } = measureBuild({ attacks: [GRENADE, explosive], modules: [avenger] });
    const crit = 1 + 1.2 * ((256 * 32) / 4095 - 1);
    expect(perShot).toBeCloseTo(75 + 350 * crit, 9);
  });

  it('can set off a chain, which counts each once', () => {
    const second = { ...BLAST, linkedAttacks: ['cluster'] };
    const cluster = { ...BLAST, id: 'cluster', linkedAttacks: ['blast'] };
    const { perShot } = measureBuild({ attacks: [GRENADE, second, cluster] });
    expect(perShot).toBeCloseTo(75 + 350 + 350, 9);
  });

  it('is still fired when two set each other off', () => {
    const first = attackOf('first', { linkedAttacks: ['second'] });
    const second = attackOf('second', { linkedAttacks: ['first'] });
    const { byAttack, perShot } = measureBuild({ attacks: [first, second] });
    expect(byAttack.map(({ attackId }) => attackId)).toEqual(['first']);
    expect(perShot).toBeCloseTo(2 * HIT, 9);
  });
});

describe('firing modes', () => {
  const attacks = [
    attackOf('quick'),
    attackOf('charged', { trigger: 'charge', chargeTime: 0.5, afterCharge: 'none', multishot: 3 }),
  ];

  it('each have their own numbers, and the first makes the headline', () => {
    const { attackId, perShot, byAttack } = measureBuild({ attacks });
    expect(attackId).toBe('quick');
    expect(perShot).toBeCloseTo(HIT, 9);
    expect(byAttack.map(({ burstDps }) => Math.round(burstDps))).toEqual([825, 619]);
  });

  it('can be chosen', () => {
    const { attackId, perShot, warnings } = measureBuild({
      attacks,
      build: { attackId: 'charged' },
    });
    expect(attackId).toBe('charged');
    expect(perShot).toBeCloseTo(3 * HIT, 9);
    expect(warnings).toEqual([]);
  });
});
