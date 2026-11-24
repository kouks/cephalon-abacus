import { describe, expect, it } from 'vitest';

import type { DamageType } from '@abacus/data/schema/damageType';

import { DAMAGE_TYPES } from '@/testing/damageTypes';
import {
  ability,
  AMPREX,
  cold,
  electricity,
  heat,
  innate,
  magneticMight,
  progenitor,
  riven,
  thermite,
  toxin,
} from '@/testing/elements';

import { combineElements } from './combineElements';
import type { ElementSource } from './types';

type Ratios = Readonly<Partial<Record<DamageType, number>>>;

/** W: the wiki states it. W?: our reading of it. The cases named T-3 wait for that in-game test. */
type Case = readonly [
  name: string,
  confidence: 'W' | 'W?',
  sources: readonly ElementSource[],
  expected: Ratios,
];

const CASES: readonly Case[] = [
  ['nothing', 'W', [], {}],
  ['one mod stays a primary', 'W', [heat(0)], { heat: 0.9 }],
  ['two mods combine: Blast', 'W', [heat(0), cold(1)], { blast: 1.8 }],
  ['in either order', 'W', [cold(0), heat(1)], { blast: 1.8 }],
  ['Corrosive', 'W', [electricity(0), toxin(1)], { corrosive: 1.8 }],
  ['Gas', 'W', [heat(0), toxin(1)], { gas: 1.8 }],
  ['Magnetic', 'W', [cold(0), electricity(1)], { magnetic: 1.8 }],
  ['Radiation', 'W', [heat(0), electricity(1)], { radiation: 1.8 }],
  ['90% Cold and 90% Toxin are 180% Viral', 'W', [cold(0), toxin(1)], { viral: 1.8 }],

  ['T-3: Heat, Cold, Toxin', 'W', [heat(0), cold(1), toxin(2)], { blast: 1.8, toxin: 0.9 }],
  ['T-3: Cold, Toxin, Heat', 'W', [cold(0), toxin(1), heat(2)], { viral: 1.8, heat: 0.9 }],
  ['T-3: Heat, Toxin, Cold', 'W', [heat(0), toxin(1), cold(2)], { gas: 1.8, cold: 0.9 }],
  [
    'slots decide, not the order of the list',
    'W',
    [heat(2), toxin(1), cold(0)],
    { viral: 1.8, heat: 0.9 },
  ],
  [
    'four mods make two secondaries',
    'W',
    [cold(0), toxin(1), heat(2), electricity(3)],
    { viral: 1.8, radiation: 1.8 },
  ],

  [
    'a second mod of an element joins the first',
    'W',
    [heat(0), cold(1), thermite(2)],
    { blast: 2.4 },
  ],
  ['next to it', 'W', [heat(0), thermite(1), cold(2)], { blast: 2.4 }],
  [
    'Thermite Rounds first place the Heat of Hellfire',
    'W',
    [thermite(0), cold(1), toxin(2), heat(3)],
    { blast: 2.4, toxin: 0.9 },
  ],
  ['alone', 'W', [heat(0), thermite(1)], { heat: 1.5 }],

  ['an innate element alone', 'W', [AMPREX], { electricity: 1 }],
  ['Amprex with Hellfire', 'W', [AMPREX, heat(0)], { radiation: 1.9 }],
  [
    'Amprex with Hellfire and Cryo Rounds',
    'W',
    [AMPREX, heat(0), cold(1)],
    { blast: 1.8, electricity: 1 },
  ],
  [
    'Amprex with Thermite Rounds last',
    'W',
    [AMPREX, heat(0), cold(1), thermite(2)],
    { blast: 2.4, electricity: 1 },
  ],
  [
    'Amprex with Thermite Rounds first',
    'W',
    [AMPREX, thermite(0), heat(1), cold(2)],
    { blast: 2.4, electricity: 1 },
  ],
  [
    'Amprex with Stormbringer first: the innate joins it',
    'W',
    [AMPREX, electricity(0), cold(1), heat(2)],
    { magnetic: 2.8, heat: 0.9 },
  ],
  [
    'Amprex with Stormbringer last',
    'W',
    [AMPREX, cold(0), heat(1), electricity(2)],
    { blast: 1.8, electricity: 1.9 },
  ],
  [
    'Prova with Cold, Toxin and Heat',
    'W',
    [innate('Prova', 'electricity'), cold(0), toxin(1), heat(2)],
    { viral: 1.8, radiation: 1.9 },
  ],

  [
    'progenitor and innate: Heat before Toxin',
    'W',
    [innate('Kuva', 'toxin'), progenitor('Kuva', 'heat', 0.6), cold(0)],
    { blast: 1.5, toxin: 1 },
  ],
  [
    'Heat before Cold',
    'W',
    [innate('Kuva', 'cold'), progenitor('Kuva', 'heat', 0.6), toxin(0)],
    { gas: 1.5, cold: 1 },
  ],
  [
    'Cold before Electricity',
    'W',
    [innate('Kuva', 'electricity'), progenitor('Kuva', 'cold', 0.6), heat(0)],
    { blast: 1.5, electricity: 1 },
  ],
  [
    'Electricity before Toxin',
    'W',
    [innate('Kuva', 'toxin'), progenitor('Kuva', 'electricity', 0.6), heat(0)],
    { radiation: 1.5, toxin: 1 },
  ],
  [
    'whichever is the progenitor',
    'W',
    [innate('Kuva', 'heat'), progenitor('Kuva', 'toxin', 0.6), cold(0)],
    { blast: 1.9, toxin: 0.6 },
  ],
  [
    'progenitor and innate alone',
    'W',
    [innate('Kuva', 'electricity'), progenitor('Kuva', 'cold', 0.6)],
    { magnetic: 1.6 },
  ],
  [
    'a progenitor joins a mod',
    'W',
    [progenitor('Kuva', 'toxin', 0.6), toxin(0), cold(1), heat(2)],
    { viral: 2.4, heat: 0.9 },
  ],

  [
    'Riven: the last-listed element combines up',
    'W',
    [cold(0), riven(1, ['electricity', 1]), riven(1, ['toxin', 0.9]), heat(2)],
    { viral: 1.8, radiation: 1.9 },
  ],
  [
    'Riven: alone, it combines with itself',
    'W',
    [riven(0, ['electricity', 1]), riven(0, ['toxin', 0.9])],
    { corrosive: 1.9 },
  ],

  [
    'an innate secondary stays: Ogris with Hellfire',
    'W',
    [innate('Ogris', 'blast'), heat(0)],
    { blast: 1, heat: 0.9 },
  ],
  [
    'Tenet Detron with Electricity',
    'W',
    [innate('Detron', 'radiation'), progenitor('Detron', 'electricity', 0.6)],
    { radiation: 1, electricity: 0.6 },
  ],
  [
    'Detron with Heat and Electricity mods',
    'W?',
    [innate('Detron', 'radiation'), heat(0), electricity(1)],
    { radiation: 2.8 },
  ],
  [
    'a mod that gives a secondary stays apart',
    'W',
    [magneticMight(0), heat(1), toxin(2)],
    { magnetic: 0.6, gas: 1.8 },
  ],
  [
    'and adds to the same secondary',
    'W?',
    [magneticMight(0), cold(1), electricity(2)],
    { magnetic: 2.4 },
  ],

  [
    'Smite Infusion with Hellfire',
    'W',
    [heat(0), ability('Smite Infusion', 'radiation', 1.1)],
    { heat: 0.9, radiation: 1.1 },
  ],
  [
    'Fireball Frenzy adds to Heat',
    'W',
    [heat(0), ability('Fireball Frenzy', 'heat', 1)],
    { heat: 1.9 },
  ],
  [
    'Fireball Frenzy does not combine with Cold',
    'W',
    [cold(0), ability('Fireball Frenzy', 'heat', 1)],
    { cold: 0.9, heat: 1 },
  ],
  [
    'nor add to a Blast',
    'W',
    [heat(0), cold(1), ability('Fireball Frenzy', 'heat', 1)],
    { blast: 1.8, heat: 1 },
  ],
  [
    'two abilities do not combine',
    'W',
    [ability('A', 'heat', 1), ability('B', 'cold', 1)],
    { heat: 1, cold: 1 },
  ],
  [
    'a special type passes through',
    'W?',
    [innate('Haalvu', 'tau'), heat(0)],
    { tau: 1, heat: 0.9 },
  ],
];

describe('combineElements', () => {
  it.each(CASES)('%s [%s]', (...[, , sources, expected]) => {
    const { ratios } = combineElements(sources, DAMAGE_TYPES);
    expect([...ratios.keys()].sort()).toEqual(Object.keys(expected).sort());
    for (const [element, ratio] of ratios) expect(ratio).toBeCloseTo(expected[element] ?? 0, 12);
  });

  it('takes its pairs from the data: without Blast, Heat and Cold stay apart', () => {
    const types = new Map([...DAMAGE_TYPES].filter(([id]) => id !== 'blast'));
    const { ratios } = combineElements([heat(0), cold(1), toxin(2)], types);
    expect(Object.fromEntries(ratios)).toEqual({ heat: 0.9, viral: 1.8 });
  });
});
