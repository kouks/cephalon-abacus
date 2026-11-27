import type { ProcTick } from './ticking';

/**
 * What happens at a moment of a fight, in simulated seconds (BIBLE §9). Each ticket that needs a
 * new kind adds it here, with its place in `RANK`.
 */
export type TimelineEvent =
  /** The trigger fires a shot: 1, or in expected value a share of the last of a magazine. */
  | { readonly kind: 'fire'; readonly at: number; readonly weight: number }
  /** A DoT proc ticks, and its next tick, if it has one, comes after. */
  | ProcTick
  | { readonly kind: 'reloadStart'; readonly at: number }
  | { readonly kind: 'reloadEnd'; readonly at: number }
  /** Its health is gone: the fight ends, and nothing else at that moment happens. */
  | { readonly kind: 'enemyDeath'; readonly at: number };

export type EventKind = TimelineEvent['kind'];

/**
 * Events at the same moment go in this order: the enemy dies before anything else can happen to it,
 * a reload ends before the shot it lets fire, and the ticks of a moment come after its shots, so
 * they meet the procs the shots inflict: an Electricity proc's first tick meets the Viral of the
 * same hit (the wiki's Viral page).
 */
export const RANK: Readonly<Record<EventKind, number>> = {
  enemyDeath: 0,
  reloadEnd: 1,
  fire: 2,
  procTick: 3,
  reloadStart: 4,
};
