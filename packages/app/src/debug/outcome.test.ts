import { describe, expect, it } from 'vitest';

import type { Result } from '@abacus/engine';

import { outcomeOf } from './outcome';

const TEXT = { isJson: true, value: {} } as const;

const result: Result = {
  apiVersion: 1,
  attackId: 'charged',
  perShot: 1234.5,
  burstDps: 9999.4,
  sustainedDps: 0,
  lifetimeDamage: Infinity,
  byAttack: [],
  layer: 'health',
  trace: [
    {
      t: 0,
      pellet: 0,
      factors: [],
      perType: new Map([['slash', 12]]),
      layer: 'health',
      procs: [],
      dots: [],
    },
  ],
  warnings: [{ code: 'unknownAttack', attackId: 'alternate' }],
};

describe('what the page shows', () => {
  it('is nothing yet, before the first answer', () => {
    expect(outcomeOf(TEXT, undefined)).toEqual({ kind: 'waiting' });
  });

  it('is what is wrong with the text, whatever the last answer was', () => {
    const broken = { isJson: false, problem: 'Not JSON' } as const;
    const problems = { kind: 'problems', problems: ['Not JSON'] };
    expect(outcomeOf(broken, { status: 'evaluated', result })).toEqual(problems);
  });

  it('is what is wrong with the scenario, or what went wrong', () => {
    const invalid = { status: 'invalid', problems: ['mode: no', 'aim: no'] } as const;
    expect(outcomeOf(TEXT, invalid)).toEqual({ kind: 'problems', problems: invalid.problems });
    const failed = { status: 'failed', message: 'No weapon' } as const;
    expect(outcomeOf(TEXT, failed)).toEqual({ kind: 'problems', problems: ['No weapon'] });
  });

  it('is the headline, the warnings and the result', () => {
    const outcome = outcomeOf(TEXT, { status: 'evaluated', result });
    expect(outcome).toMatchObject({
      kind: 'result',
      headline: [
        { label: 'Per shot', value: '1,235' },
        { label: 'Burst DPS', value: '9,999' },
        { label: 'Sustained DPS', value: '0' },
        { label: 'Lifetime damage', value: 'Unlimited' },
      ],
      oneHit: [],
      warnings: ['{"code":"unknownAttack","attackId":"alternate"}'],
      rows: [],
    });
  });

  it('is the enemy’s stats too, unless it is the neutral dummy', () => {
    const stat = (value: number) => ({ value, terms: [] });
    const enemy = {
      level: 1200,
      health: stat(72_877.1),
      shield: stat(0),
      armor: stat(2700),
      overguard: stat(12.5),
    };
    const outcome = outcomeOf(TEXT, {
      status: 'evaluated',
      result: { ...result, enemy, layer: 'overguard' },
    });
    expect(outcome).toMatchObject({
      enemy: [
        { label: 'Hits meet', value: 'Overguard' },
        { label: 'Level', value: '1,200' },
        { label: 'Health', value: '72,877' },
        { label: 'Shields', value: '0' },
        { label: 'Armor', value: '2,700' },
        { label: 'Overguard', value: '13' },
      ],
    });
    expect(outcomeOf(TEXT, { status: 'evaluated', result })).toMatchObject({ enemy: [] });
  });

  it('has the armor after strips, where they lowered it', () => {
    const stat = (value: number) => ({ value, terms: [] });
    const enemy = {
      level: 100,
      health: stat(1),
      shield: stat(0),
      armor: stat(2700),
      overguard: stat(0),
    };
    const [first] = result.trace;
    const withArmor = (armor: number) =>
      outcomeOf(TEXT, {
        status: 'evaluated',
        result: { ...result, enemy, trace: first === undefined ? [] : [{ ...first, armor }] },
      });
    const labels = (armor: number) => {
      const outcome = withArmor(armor);
      return outcome.kind === 'result'
        ? outcome.enemy.map(({ label, value }) => `${label} ${value}`)
        : [];
    };
    expect(labels(2214)).toContain('Armor after strips 2,214');
    expect(labels(2700).some((line) => line.startsWith('Armor after strips'))).toBe(false);
  });

  it('has maps and infinity in its JSON', () => {
    const outcome = outcomeOf(TEXT, { status: 'evaluated', result });
    const json: unknown = JSON.parse(outcome.kind === 'result' ? outcome.json : '');
    expect(json).toMatchObject({ lifetimeDamage: 'Infinity', trace: [{ perType: { slash: 12 } }] });
  });
});
