/** How likely a hit is to be of a tier: 0 white, 1 yellow, 2 orange, 3 and up red. */
export type TierChance = { readonly tier: number; readonly chance: number };

/** A chance to raise a hit's tier by one: a body part that promotes hits, or the Vigilante set. */
export type TierRaise = {
  readonly chance: number;
  /** The lowest tier it raises. */
  readonly from: number;
};

/** One entry per tier that can happen, in the order given. */
const tally = (entries: readonly TierChance[]): readonly TierChance[] => {
  const chances = new Map<number, number>();
  for (const { tier, chance } of entries) chances.set(tier, (chances.get(tier) ?? 0) + chance);
  return [...chances]
    .map(([tier, chance]) => ({ tier, chance }))
    .filter(({ chance }) => chance > 0);
};

const raise = (tiers: readonly TierChance[], { chance: odds, from }: TierRaise) =>
  tally(
    tiers.flatMap(({ tier, chance }) =>
      tier < from
        ? [{ tier, chance }]
        : [
            { tier, chance: chance * (1 - odds) },
            { tier: tier + 1, chance: chance * odds },
          ],
    ),
  );

/** Every 100% is a sure tier, and the rest is the chance of one more. Raises apply in order. */
export const critTiers = (
  critChance: number,
  raises: readonly TierRaise[] = [],
): readonly TierChance[] => {
  const sure = Math.floor(critChance);
  const more = critChance - sure;
  const rolled = [
    { tier: sure, chance: 1 - more },
    { tier: sure + 1, chance: more },
  ];
  return raises.reduce(raise, tally(rolled));
};

/** 1 + tier × (crit multiplier − 1). Never negative, however low the multiplier. */
export const tierMultiplier = (tier: number, critMultiplier: number): number =>
  Math.max(1 + tier * (critMultiplier - 1), 0);

/** The mean over the tiers: 1 + crit chance × (crit multiplier − 1), unless something raises them. */
export const expectedCrit = (tiers: readonly TierChance[], critMultiplier: number): number =>
  tiers.reduce((sum, { tier, chance }) => sum + chance * tierMultiplier(tier, critMultiplier), 0);
