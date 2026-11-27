import { assertNever } from '@abacus/data/assert';

import type { Cycle } from './cycle';
import type { EnemyState } from './enemyState';
import type { TimelineEvent } from './events';
import type { Fight, PelletHit, Strike } from './pellet';
import type { Handler } from './run';
import { runUntil } from './run';
import { pullTrigger } from './trigger';
import type { CycleEvent, CycleState } from './weaponCycle';
import { advance, loaded } from './weaponCycle';

/** A fight as it stands: the enemy, where the weapon is in its cycle, and when the enemy died. */
type Fighting = {
  readonly enemy: EnemyState;
  readonly cycle: CycleState;
  readonly diedAt?: number;
};

/** One pellet's hit on one part, and when it landed. */
export type TimedHit = PelletHit & { readonly at: number };

/** One firing mode against one enemy: how it fires, what each shot strikes, and the enemy. */
export type Setup = {
  readonly cycle: Cycle;
  readonly strikes: readonly Strike[];
  readonly fight: Fight;
  readonly enemy: EnemyState;
};

type Fire = Extract<TimelineEvent, { kind: 'fire' }>;

/** The handler's own: the setup, and the hits as they land. */
type Context = Setup & { readonly hits: TimedHit[] };

/** A shot against the enemy as it is then: stacks that have ended by then do nothing (BIBLE §3). */
const onFire = (context: Context, state: Fighting, event: Fire) => {
  const { at, weight } = event;
  const before = { ...state.enemy, at };
  const pulled = pullTrigger(before, { strikes: context.strikes, weight }, context.fight);
  context.hits.push(...pulled.hits.map((hit) => ({ ...hit, at })));
  const cycled = advance(context.cycle, { state: state.cycle, event }, context.fight.roller);
  const isDead = pulled.state.left.health <= 0;
  return {
    state: { enemy: pulled.state, cycle: cycled.state },
    next: isDead ? [{ kind: 'enemyDeath', at } as const, ...cycled.next] : cycled.next,
  };
};

const onCycle = (context: Context, state: Fighting, event: CycleEvent) => {
  const cycled = advance(context.cycle, { state: state.cycle, event }, context.fight.roller);
  return { state: { ...state, cycle: cycled.state }, next: cycled.next };
};

const handlerOf =
  (context: Context): Handler<Fighting> =>
  (state, event) => {
    switch (event.kind) {
      case 'fire':
        return onFire(context, state, event);
      case 'reloadStart':
      case 'reloadEnd':
        return onCycle(context, state, event);
      case 'enemyDeath':
        return { state: { ...state, diedAt: event.at }, next: [], isOver: true };
      default:
        return assertNever(event);
    }
  };

/** How a fight went: every hit, and when the enemy died, if it did. */
export type Fought = { readonly hits: readonly TimedHit[]; readonly diedAt?: number };

/**
 * A fight over time, from a full magazine until the enemy dies or the time is up (BIBLE §9): each shot
 * pulls the trigger against the enemy as the hits before it left it.
 */
export const fightUntil = (setup: Setup, until: number): Fought => {
  const hits: TimedHit[] = [];
  const start = loaded(setup.cycle, 0, setup.fight.roller);
  const end = runUntil(
    { state: { enemy: setup.enemy, cycle: start.state }, events: start.next },
    handlerOf({ ...setup, hits }),
    until,
  );
  return { hits, ...(end.diedAt === undefined ? {} : { diedAt: end.diedAt }) };
};
