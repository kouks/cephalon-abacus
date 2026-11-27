import type { Layer } from '@abacus/data/schema/damageTypeRule';

import type { LayeredHit } from '@/resolve/applyHit';
import { applyHit } from '@/resolve/applyHit';
import type { Defence } from '@/resolve/defence';
import { layerLeft } from '@/resolve/defence';
import { f32Product, product, targetSide, tickLayer } from '@/resolve/dot/tick';
import { armorMet } from '@/resolve/strips';
import { withTaken } from '@/resolve/taken';
import type { Factor, TickTrace } from '@/trace/hitTrace';

import type { EnemyState } from './enemyState';
import { takenFrom } from './enemyState';
import type { Fight } from './pellet';
import { leftAfter } from './pellet';
import type { Ticking } from './ticking';

/** The enemy's side of a tick on each layer, with the statuses on the enemy as they are then. */
const sidesOf = (state: EnemyState, proc: Ticking, fight: Fight) => {
  const built = withTaken(proc.built, takenFrom(state, fight.library));
  const defence: Defence = { ...fight.defence, left: state.left, layer: layerLeft(state.left) };
  const on = (layer: Layer): readonly Factor[] => {
    const at = { ...defence, layer };
    const met = { defence: at, armor: armorMet(at, built) };
    return targetSide(proc.dot, { totals: built.totals, target: fight.target, met });
  };
  const sides = { overguard: on('overguard'), shield: on('shield'), health: on('health') };
  return { defence, sides, isShownInOwnTerms: built.assumptions.breakShownInOwnTerms };
};

/**
 * One tick of a DoT proc on the enemy as it is when the tick lands (BIBLE §8): with the Viral,
 * Magnetic and Corrosive stacks on it then, on the first layer it has left that the tick's type
 * damages. The tick wears its layers down as a hit does, but on no weak point: what is left of one
 * that breaks shields goes on at 5%.
 */
export const landTick = (state: EnemyState, proc: Ticking, fight: Fight) => {
  const { defence, sides, isShownInOwnTerms } = sidesOf(state, proc, fight);
  const attacker = f32Product(proc.attacker);
  const damageOn = (layer: Layer) => attacker * product(sides[layer]);
  const hitOf = (layer: Layer) => new Map([[proc.dot.dealsAs, damageOn(layer)]]);
  const layered: LayeredHit = {
    overguard: hitOf('overguard'),
    shield: hitOf('shield'),
    health: hitOf('health'),
  };
  const applied = applyHit(state.left, layered, { isWeakPoint: false, isShownInOwnTerms });
  const layer = tickLayer(proc.dot, defence);
  const { dot, tier, share, seed } = proc;
  const tick: TickTrace = {
    t: state.at,
    status: dot.status,
    tier,
    share,
    seed,
    factors: [...proc.attacker, ...sides[layer]],
    damage: damageOn(layer),
    layer,
  };
  return { state: { ...state, left: leftAfter(state.left, [[share, applied.left]]) }, tick };
};
