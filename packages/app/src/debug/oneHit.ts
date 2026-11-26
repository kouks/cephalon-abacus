import type { Dealt, TierDealt } from '@abacus/engine';

import { formatDamage } from '@/format/numbers';

import type { HeadlineNumber } from './outcome';

const COLOUR_NAMES = ['White', 'Yellow', 'Orange'] as const;

/** The game draws every tier from the third on in red. */
const colourOf = (tier: number) =>
  COLOUR_NAMES[tier] ?? (tier === 3 ? 'Red' : `Red (tier ${tier})`);

const LAYER_NAMES = { overguard: 'Overguard', shield: 'Shields', health: 'Health' } as const;

/**
 * "1,958 (1,079 applied)": the game's number first, and what the enemy loses if it differs. A layer
 * that shows no number of its own is in the one before it (T-44).
 */
const shownOf = ({ shown, applied }: Dealt) => {
  const lost = formatDamage(applied);
  if (shown === undefined) return `${lost} applied, in the number before`;
  const number = formatDamage(shown);
  return lost === number ? number : `${number} (${lost} applied)`;
};

const rowOf = ({ tier, dealt }: TierDealt): HeadlineNumber => ({
  label: `${colourOf(tier)} hit`,
  value: dealt.map((layer) => `${LAYER_NAMES[layer.layer]} ${shownOf(layer)}`).join(', '),
});

type Shot = {
  readonly shot: { readonly hits: readonly { readonly dealt: readonly TierDealt[] }[] };
};

/** What of a `Result` the numbers come from. */
export type Fired = {
  readonly attackId: string;
  readonly byAttack: readonly { readonly attackId: string; readonly shots: readonly Shot[] }[];
};

/**
 * What one hit of each colour shows and applies on the enemy as it is: the headline shot's first
 * hit. Empty for the neutral dummy, and for a firing mode with no hit.
 */
export const oneHitOf = ({ byAttack, attackId }: Fired): readonly HeadlineNumber[] => {
  const attack = byAttack.find((entry) => entry.attackId === attackId);
  const hit = attack?.shots[0]?.shot.hits[0];
  return hit?.dealt.map(rowOf) ?? [];
};
