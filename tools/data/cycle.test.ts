import { describe, expect, it } from 'vitest';

import { must } from '#data/assert.ts';
import { firingModes } from '#engine/metrics/firingModes.ts';
import { linesOf, scheduleOf, shotsPerSecond } from '#engine/testing/schedule.ts';
import { cycleOf } from '#engine/timeline/cycle.ts';

import { realAttack, realLibrary as library } from './realAttack.ts';

const scheduleFor = (weaponId: string, attackId: string, until: number) => {
  const weapon = must(library.weapons.get(weaponId), `No weapon "${weaponId}"`);
  return scheduleOf(cycleOf(weapon, realAttack(weaponId, attackId)), until);
};

/** The events from the last shot of the first magazine on. */
const firstReload = (weaponId: string, attackId: string, until: number) => {
  const lines = linesOf(scheduleFor(weaponId, attackId, until));
  return lines.slice(lines.findIndex((line) => line.startsWith('reloadStart')) - 1);
};

describe('the seed weapons reload', () => {
  it('Braton: after its 45th shot and the delay, for 2 s', () => {
    expect(firstReload('braton', 'normal', 7.2)).toEqual([
      'fire 5.0286',
      'reloadStart 5.1429',
      'reloadEnd 7.1429',
      'fire 7.1429',
    ]);
  });

  it('Vectis: at its one shot, for 1 s', () => {
    expect(linesOf(scheduleFor('vectis', 'normal', 2.5))).toEqual([
      'fire 0',
      'reloadStart 0',
      'reloadEnd 1',
      'fire 1',
      'reloadStart 1',
      'reloadEnd 2',
      'fire 2',
      'reloadStart 2',
    ]);
  });

  it('Paris, charged: after every shot, which charges for 0.5 s', () => {
    expect(linesOf(scheduleFor('paris', 'charged', 2))).toEqual([
      'fire 0.5',
      'reloadStart 0.5',
      'reloadEnd 1.15',
      'fire 1.65',
      'reloadStart 1.65',
    ]);
  });

  it('Burston: after 15 bursts of 3, 0.061 s apart and 0.2 s between bursts', () => {
    const lines = linesOf(scheduleFor('burston', 'normal', 6.85));
    expect(lines.slice(0, 4)).toEqual(['fire 0', 'fire 0.061', 'fire 0.122', 'fire 0.322']);
    expect(lines.slice(44)).toEqual([
      'fire 4.63',
      'reloadStart 4.83',
      'reloadEnd 6.83',
      'fire 6.83',
    ]);
  });
});

describe('every seed weapon', () => {
  const modes = [...library.weapons.values()].flatMap((weapon) =>
    firingModes(weapon).map((attack) => [`${weapon.name}, ${attack.name}`, weapon.id, attack.id]),
  );

  it.each(modes)(
    '%s fires as many shots a second as the closed form',
    (_name, weaponId, attackId) => {
      const { effectiveFireRate, shootingProportion } = realAttack(weaponId, attackId).rates;
      const events = scheduleFor(weaponId, attackId, 600);
      expect(shotsPerSecond(events)).toBeCloseTo(effectiveFireRate * shootingProportion, 9);
    },
  );
});
