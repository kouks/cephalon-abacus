import { describe, expect, it } from 'vitest';

import { loadLibrary } from '@abacus/data/load/loadLibrary';
import { damageTypes, libraryFile, referenceFiles } from '@abacus/data/testing/fixtures';

import { statusRuleOf } from './statusRules';

const FREEZE = {
  id: 'freeze',
  name: 'Freeze',
  source: 'https://wiki.warframe.com/w/Damage/Cold_Damage',
  gameVersion: '44.1.4.1',
  duration: 6,
  stacking: { kind: 'capped', most: 10 },
  confidence: 'W',
};

const library = (() => {
  const types = damageTypes.map((item) =>
    item.id === 'cold' ? { ...item, proc: 'freeze' } : item,
  );
  const result = loadLibrary([
    libraryFile('damageTypes.json', ...types),
    ...referenceFiles.filter(({ path }) => !['damageTypes.json', 'statuses.json'].includes(path)),
    libraryFile('statuses.json', FREEZE),
  ]);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.library;
})();

describe('the status a type procs', () => {
  it('is the one its proc names, with its stacking', () => {
    expect(statusRuleOf('cold', library)).toMatchObject({
      status: { id: 'freeze', duration: 6 },
      stacking: { kind: 'capped', most: 10 },
    });
  });

  it('has the enemy’s own cap, where it has one', () => {
    expect(statusRuleOf('cold', library, { statusCaps: { cold: 4 } })?.cap).toBe(4);
    expect(statusRuleOf('cold', library, { statusCaps: { heat: 4 } })).not.toHaveProperty('cap');
  });

  it('is none for a type that procs none', () => {
    expect(statusRuleOf('true', library)).toBeUndefined();
  });
});
