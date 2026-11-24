import { describe, expect, it } from 'vitest';

import { formatBonus, formatDamage, formatFlat, formatMultiplier } from './numbers';

describe('numbers', () => {
  it.each([
    [12_345.4, '12,345'],
    [28.5, '29'],
    [0, '0'],
    [Infinity, 'Unlimited'],
  ])('show %d damage as %s', (damage, text) => {
    expect(formatDamage(damage)).toBe(text);
  });

  it.each([
    [2.2, '2.2x'],
    [1, '1x'],
    [0.90625, '0.9063x'],
    [1234.5, '1,234.5x'],
  ])('show a multiplier of %d as %s', (multiplier, text) => {
    expect(formatMultiplier(multiplier)).toBe(text);
  });

  it.each([
    [1.65, '+165%'],
    [0.2849, '+28.5%'],
    [-0.1998, '-20%'],
    [0, '+0%'],
  ])('show a bonus of %d as %s', (bonus, text) => {
    expect(formatBonus(bonus)).toBe(text);
  });

  it.each([
    [3.498, '+3.498'],
    [-0.5, '-0.5'],
  ])('show %d, added as it is, as %s', (value, text) => {
    expect(formatFlat(value)).toBe(text);
  });
});
