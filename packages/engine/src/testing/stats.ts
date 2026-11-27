/** A weapon's stats and rates, from mods to numbers. */
import { must } from '@abacus/data/assert';
import { weapon } from '@abacus/data/testing/fixtures';

import type { Assumptions } from '@/assumptions';
import { DEFAULT_ASSUMPTIONS } from '@/assumptions';
import { collectEffects } from '@/build/collectEffects';
import { selectionOf } from '@/build/selectEffects';
import { attackRates } from '@/build/stats/attackRates';
import { attackStats } from '@/build/stats/attackStats';
import { totalBuckets } from '@/build/totalBuckets';

import { makeLibrary, makeScenario, mod } from './build';

export type Setup = {
  readonly effects?: readonly object[];
  readonly attack?: object;
  readonly weaponChange?: object;
  readonly assumptions?: Partial<Assumptions>;
};

const [baseAttack] = weapon.attacks;

/** The test rifle with some effects on it, ready to be totalled. */
export const equip = ({ effects = [], attack = {}, weaponChange = {}, ...rest }: Setup) => {
  const library = makeLibrary([mod('build', effects)], {
    attacks: [{ ...baseAttack, ...attack }],
    ...weaponChange,
  });
  const rifle = must(library.weapons.get('test-rifle'), 'no weapon');
  return {
    library,
    rifle,
    fired: must(rifle.attacks[0], 'no attack'),
    collected: collectEffects(makeScenario([{ moduleId: 'build' }]), library),
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...rest.assumptions },
  };
};

/** The test rifle: 8 shots/s, 45 rounds, 2 s reload, 20% crit at 2x, 10% status. */
export const measure = (setup: Setup = {}) => {
  const { library, rifle, fired, collected, assumptions } = equip(setup);
  const selection = selectionOf(rifle, fired);
  const totals = totalBuckets(collected, library, { selection });
  const procTotals = totalBuckets(collected, library, {
    selection: { ...selection, scope: 'proc' },
  });
  const stats = attackStats(rifle, fired, { totals, procTotals, assumptions });
  return { stats, rates: attackRates(rifle, fired, stats), attack: fired, weapon: rifle };
};
