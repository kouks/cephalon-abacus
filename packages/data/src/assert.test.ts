import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { assertNever, invariant, must } from './assert';

describe('must', () => {
  it('returns any present value unchanged, falsy ones included', () => {
    const present = fc.anything().filter((value) => value !== null && value !== undefined);
    fc.assert(
      fc.property(present, (value) => {
        expect(must(value, 'missing')).toBe(value);
      }),
    );
  });

  it.each([null, undefined])('throws the message for %s', (value) => {
    expect(() => must(value, 'no such mod')).toThrow('no such mod');
  });
});

describe('invariant', () => {
  it('passes a true condition', () => {
    expect(() => {
      invariant(1 + 1 === 2, 'unreachable');
    }).not.toThrow();
  });

  it('throws the message for a false condition', () => {
    expect(() => {
      invariant(false, 'crit chance is negative');
    }).toThrow('crit chance is negative');
  });
});

describe('assertNever', () => {
  it('names the value it was given', () => {
    const value: unknown = { kind: 'mystery' };
    expect(() => assertNever(value as never)).toThrow('Unexpected value: {"kind":"mystery"}');
  });
});
