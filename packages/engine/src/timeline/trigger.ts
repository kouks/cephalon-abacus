import type { EnemyState } from './enemyState';
import type { Fight, PelletHit, Strike } from './pellet';
import { strikePellet } from './pellet';

/** The pellets a strike fires: whole ones, and in expected value a share of one more. */
const pelletsOf = ({ built }: Strike, { roller }: Fight): readonly number[] => {
  const count = roller.count(built.stats.multishot.value);
  const whole = Math.floor(count);
  return [...Array.from({ length: whole }, () => 1), ...(count > whole ? [count - whole] : [])];
};

type Pulled = { readonly state: EnemyState; readonly hits: readonly PelletHit[] };

type Pulling = Pulled & { readonly pellets: number };

/**
 * One trigger pull: each strike's pellets one at a time, against what the ones before them left, in
 * order: a direct hit, then its explosion (BIBLE §3, §5).
 */
export const pullTrigger = (
  state: EnemyState,
  strikes: readonly Strike[],
  fight: Fight,
): Pulled => {
  const pulled = strikes.reduce<Pulling>(
    (sofar, strike) =>
      pelletsOf(strike, fight).reduce<Pulling>((before, weight) => {
        const pellet = { index: before.pellets, weight };
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
