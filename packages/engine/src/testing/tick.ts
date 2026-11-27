/** A DoT proc of the test rifle, and an enemy for it to tick on. */
import { must } from '@abacus/data/assert';

import { buildAttack } from '@/build/buildAttack';
import type { LayersLeft } from '@/resolve/applyHit';
import { attackerSide } from '@/resolve/dot/tick';
import { EXPECTED_ROLLER } from '@/resolve/roller';
import type { Fight } from '@/timeline/pellet';
import type { Ticking } from '@/timeline/ticking';

import { makeLibrary } from './build';
import { loadoutOf, makeTarget } from './hit';

const library = makeLibrary([]);

/** What damageTypes.json says of the types ticks deal: Toxin skips shields, Cinematic bypasses armor. */
const AS_IN_THE_GAME: Readonly<Record<string, object>> = {
  toxin: { layers: { overguard: 1, health: 1 } },
  cinematic: { bypassArmor: true },
};

const rules = new Map(
  [...library.damageTypes].map(([type, rule]) => [type, { ...rule, ...AS_IN_THE_GAME[type] }]),
);

type Proc = {
  readonly status?: string;
  readonly attack?: object;
  readonly modules?: readonly { readonly id: string }[];
  readonly seed?: number;
  readonly share?: number;
};

/** One proc of a status with a seed of 100, unmodded: a bleed ticks (100 + 1) × 0.35. */
export const procOf = (proc: Proc = {}): Ticking => {
  const { status = 'bleed', attack = {}, modules = [], seed = 100, share = 1 } = proc;
  const loadout = loadoutOf({ attack, modules });
  const built = buildAttack(loadout, must(loadout.weapon.attacks[0], 'An attack'));
  const dot = must(built.dots.get(status), `${status} ticks`);
  const attacker = attackerSide(dot, seed, { procTotals: built.procTotals, target: makeTarget() });
  return { dot, built, tier: 0, seed, share, attacker, later: [] };
};

/** An enemy with 1,000 health and what else it is given, without armor unless it says so. */
export const fightOn = (left: Partial<LayersLeft> = {}, armor = 0): Fight => ({
  target: makeTarget(),
  defence: {
    layer: 'health',
    armor,
    rules,
    left: { overguard: 0, shield: 0, health: 1000, ...left },
  },
  library,
  enemy: {},
  roller: EXPECTED_ROLLER,
});
