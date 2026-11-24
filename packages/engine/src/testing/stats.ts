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

type Setup = {
  readonly effects?: readonly object[];
  readonly attack?: object;
  readonly weaponChange?: object;
  readonly assumptions?: Assumptions;
};

const [baseAttack] = weapon.attacks;

/** The test rifle: 8 shots/s, 45 rounds, 2 s reload, 20% crit at 2x, 10% status. */
export const measure = ({ effects = [], attack = {}, weaponChange = {}, ...rest }: Setup = {}) => {
  const { assumptions = DEFAULT_ASSUMPTIONS } = rest;
  const library = makeLibrary([mod('build', effects)], {
    attacks: [{ ...baseAttack, ...attack }],
    ...weaponChange,
  });
  const rifle = must(library.weapons.get('test-rifle'), 'no weapon');
  const fired = must(rifle.attacks[0], 'no attack');
  const collected = collectEffects(makeScenario([{ moduleId: 'build' }]), library);
  const totals = totalBuckets(collected, library, { selection: selectionOf(rifle, fired) });
  const stats = attackStats(rifle, fired, { totals, assumptions });
  return { stats, rates: attackRates(rifle, fired, stats) };
};
