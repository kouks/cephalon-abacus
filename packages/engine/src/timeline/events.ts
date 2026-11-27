/**
 * What happens at a moment of a fight, in simulated seconds (BIBLE §9). Each ticket that needs a
 * new kind adds it here, with its place in `RANK`.
 */
export type TimelineEvent =
  /** The trigger fires a shot: 1, or in expected value a share of the last of a magazine. */
  | { readonly kind: 'fire'; readonly at: number; readonly weight: number }
  | { readonly kind: 'reloadStart'; readonly at: number }
  | { readonly kind: 'reloadEnd'; readonly at: number };

export type EventKind = TimelineEvent['kind'];

/** Events at the same moment go in this order: a reload ends before the shot it lets fire. */
export const RANK: Readonly<Record<EventKind, number>> = {
  reloadEnd: 0,
  fire: 1,
  reloadStart: 2,
};
