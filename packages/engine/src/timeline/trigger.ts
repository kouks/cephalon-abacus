import type { EnemyState } from './enemyState';
import type { Fight, PelletHit, Strike } from './pellet';
import { strikePellet } from './pellet';

/**
 * The pellets a strike fires: whole ones, and in expected value a share of one more. Each is as much
 * of a pellet as the shot is of a shot.
 */
const pelletsOf = ({ built }: Strike, weight: number, { roller }: Fight): readonly number[] => {
  const count = roller.count(built.stats.multishot.value);
  const whole = Math.floor(count);
  const shares = [
    ...Array.from({ length: whole }, () => 1),
    ...(count > whole ? [count - whole] : []),
  ];
  return shares.map((share) => share * weight);
};

/** The strikes of one shot, and how much of a shot it is: 1, or the share of the last of a magazine. */
export type Shot = { readonly strikes: readonly Strike[]; readonly weight: number };

type Pulled = { readonly state: EnemyState; readonly hits: readonly PelletHit[] };

type Pulling = Pulled & { readonly pellets: number };

/**
 * One trigger pull: each strike's pellets one at a time, against what the ones before them left, in
 * order: a direct hit, then its explosion (BIBLE §3, §5).
 */
export const pullTrigger = (state: EnemyState, { strikes, weight }: Shot, fight: Fight): Pulled => {
  const pulled = strikes.reduce<Pulling>(
    (sofar, strike) =>
      pelletsOf(strike, weight, fight).reduce<Pulling>((before, share) => {
        const pellet = { index: before.pellets, weight: share };
        const next = strikePellet(before.state, strike, { pellet, fight });
        return {
          state: next.state,
          hits: [...before.hits, ...next.hits],
          pellets: before.pellets + 1,
        };
      }, sofar),
    { state, hits: [], pellets: 0 },
  );
  return { state: pulled.state, hits: pulled.hits };
};
