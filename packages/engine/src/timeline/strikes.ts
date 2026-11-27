import type { Attack } from '@abacus/data/schema/attack';
import type { Scenario } from '@abacus/data/schema/scenario';

import { buildAttack } from '@/build/buildAttack';
import type { Loadout } from '@/build/loadout';
import { withLinked } from '@/metrics/firingModes';
import type { Target } from '@/resolve/target';
import { partsHit } from '@/resolve/target';

import type { Strike } from './pellet';

type Aimed = Pick<Scenario, 'aim' | 'distance'> & { readonly target: Target };

/**
 * What one shot of a firing mode strikes, as `evaluate` has it (BIBLE §9): the shot, then what it
 * sets off, each built for every part it hits, at the shot's range and where it lands.
 */
export const strikesOf = (loadout: Loadout, attack: Attack, aimed: Aimed): readonly Strike[] => {
  const reach = buildAttack(loadout, attack).stats.range;
  const { distance, aim } = aimed;
  return withLinked(attack, loadout.weapon).map((fired) => ({
    built: buildAttack(loadout, fired),
    parts: partsHit(fired, aimed).map((struck) => ({
      ...struck,
      built: buildAttack(loadout, fired, { bodyParts: struck.part.bodyParts }),
    })),
    distance,
    reach,
    missBy: aim.missBy,
  }));
};
