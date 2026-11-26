import { describe, expect, it } from 'vitest';

import { makeLibrary } from '@/testing/build';

import { statusRuleOf } from './statusRules';

const library = makeLibrary([]);

describe('a status’s rule', () => {
  it('is its stacking, with no cap of the enemy’s own', () => {
    expect(statusRuleOf('freeze', library)).toEqual({
      status: expect.objectContaining({ id: 'freeze', duration: 6 }) as unknown,
      stacking: { kind: 'capped', most: 10 },
    });
  });

  it('has the enemy’s own cap, which statusCaps names by the damage type', () => {
    expect(statusRuleOf('freeze', library, { statusCaps: { cold: 4 } }).cap).toBe(4);
    expect(statusRuleOf('freeze', library, { statusCaps: { heat: 4 } })).not.toHaveProperty('cap');
  });

  it('has Cold’s 4 while the enemy has Overguard left (the wiki’s Cold page)', () => {
    expect(statusRuleOf('freeze', library, { hasOverguard: true }).cap).toBe(4);
    expect(statusRuleOf('freeze', library, { hasOverguard: false })).not.toHaveProperty('cap');
    expect(
      statusRuleOf('freeze', library, { hasOverguard: true, statusCaps: { cold: 2 } }).cap,
    ).toBe(2);
  });

  it('has no Overguard cap for a status that has none', () => {
    expect(statusRuleOf('virus', library, { hasOverguard: true })).not.toHaveProperty('cap');
  });

  it('is an error for a status the library lacks', () => {
    expect(() => statusRuleOf('nowhere', library)).toThrow('No status "nowhere"');
  });
});
