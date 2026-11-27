import { assertNever } from '@abacus/data/assert';

import type { TickTrace } from '@/trace/hitTrace';

import type { Cycle } from './cycle';
import type { EnemyState } from './enemyState';
import type { TimelineEvent } from './events';
import { landTick } from './landTick';
import type { Fight, PelletHit, Strike } from './pellet';
import type { Handler } from './run';
import { runUntil } from './run';
import type { ProcTick } from './ticking';
import { firstTicks, nextTick } from './ticking';
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

/** The handler's own: the setup, and the hits and ticks as they land. */
type Context = Setup & { readonly hits: TimedHit[]; readonly ticks: TickTrace[] };

/** The enemy dies at the moment its health is gone. */
const deathOf = ({ left }: EnemyState, at: number): readonly TimelineEvent[] =>
  left.health <= 0 ? [{ kind: 'enemyDeath', at }] : [];

/** A shot against the enemy as it is then: stacks that have ended by then do nothing (BIBLE §3). */
const onFire = (context: Context, state: Fighting, event: Fire) => {
  const { at, weight } = event;
  const before = { ...state.enemy, at };
  const pulled = pullTrigger(before, { strikes: context.strikes, weight }, context.fight);
  context.hits.push(...pulled.hits.map((hit) => ({ ...hit, at })));
  const { target } = context.fight;
  const ticks = pulled.hits.flatMap((hit) => firstTicks(hit, { at, target }));
  const cycled = advance(context.cycle, { state: state.cycle, event }, context.fight.roller);
  return {
    state: { enemy: pulled.state, cycle: cycled.state },
    next: [...deathOf(pulled.state, at), ...cycled.next, ...ticks],
  };
};

/** A tick against the enemy as it is then, and the proc's next tick (BIBLE §8). */
const onTick = (context: Context, state: Fighting, { at, proc }: ProcTick) => {
  const landed = landTick({ ...state.enemy, at }, proc, context.fight);
  context.ticks.push(landed.tick);
  return {
    state: { ...state, enemy: landed.state },
    next: [...deathOf(landed.state, at), ...nextTick(proc, proc.later)],
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
      case 'procTick':
        return onTick(context, state, event);
      case 'reloadStart':
      case 'reloadEnd':
        return onCycle(context, state, event);
      case 'enemyDeath':
        return { state: { ...state, diedAt: event.at }, next: [], isOver: true };
      default:
        return assertNever(event);
    }
  };

/** How a fight went: every hit and every tick, and when the enemy died, if it did. */
export type Fought = {
  readonly hits: readonly TimedHit[];
  readonly ticks: readonly TickTrace[];
  readonly diedAt?: number;
};

/**
 * A fight over time, from a full magazine until the enemy dies or the time is up (BIBLE §9): each shot
 * pulls the trigger against the enemy as the hits and ticks before it left it, and each proc ticks
 * against the enemy as it is then.
 */
export const fightUntil = (setup: Setup, until: number): Fought => {
  const hits: TimedHit[] = [];
  const ticks: TickTrace[] = [];
  const start = loaded(setup.cycle, 0, setup.fight.roller);
  const end = runUntil(
    { state: { enemy: setup.enemy, cycle: start.state }, events: start.next },
    handlerOf({ ...setup, hits, ticks }),
    until,
  );
  return { hits, ticks, ...(end.diedAt === undefined ? {} : { diedAt: end.diedAt }) };
};
