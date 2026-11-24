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
  trace: [
    {
      t: 0,
      pellet: 0,
      factors: [],
      perType: new Map([['slash', 12]]),
      layer: 'health',
      procs: [],
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
      warnings: ['{"code":"unknownAttack","attackId":"alternate"}'],
      rows: [],
    });
  });

  it('has maps and infinity in its JSON', () => {
    const outcome = outcomeOf(TEXT, { status: 'evaluated', result });
    const json: unknown = JSON.parse(outcome.kind === 'result' ? outcome.json : '');
    expect(json).toMatchObject({ lifetimeDamage: 'Infinity', trace: [{ perType: { slash: 12 } }] });
  });
});
