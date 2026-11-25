/** A rule the wiki doesn't settle: what the engine assumes, and the in-game test that decides it. */
export type Assumption = {
  readonly default: boolean;
  /** The in-game test that settles it (BIBLE §16). */
  readonly test: `T-${number}`;
  /** The BIBLE section that states the rule. */
  readonly bible: `§${number}`;
};

/** Every such rule the engine reads. Each is added by the ticket whose code first needs it. */
export const ASSUMPTIONS = {
  /** Fire rate bonuses count double on bows. Confirmed: Paris charges in 0.23 s with +60%. */
  bowFireRateDoubled: { default: true, test: 'T-10', bible: '§9' },
  /** A headcrit multiplies the modded crit multiplier, not the base alone. Confirmed. */
  headcritScalesModded: { default: true, test: 'T-4', bible: '§7' },
  /** It multiplies flat crit damage too, such as Cold's. Only with headcritScalesModded. */
  headcritScalesFlat: { default: true, test: 'T-5', bible: '§7' },
  /** Cold's +0.1x is added to the crit multiplier. If not: it is 10% of the base. */
  coldCritDamageAbsolute: { default: true, test: 'T-5', bible: '§7' },
  /** Procs pick their type by quantized damage, so a type at zero never procs. Confirmed. */
  procWeightsQuantized: { default: true, test: 'T-14', bible: '§6' },
  /** Falloff drops in a line to nothing at its end, and stops at the least. Confirmed. */
  falloffHeadsForZero: { default: true, test: 'T-26', bible: '§11' },
} as const satisfies Readonly<Record<string, Assumption>>;

export type Assumptions = Readonly<Record<keyof typeof ASSUMPTIONS, boolean>>;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  bowFireRateDoubled: ASSUMPTIONS.bowFireRateDoubled.default,
  headcritScalesModded: ASSUMPTIONS.headcritScalesModded.default,
  headcritScalesFlat: ASSUMPTIONS.headcritScalesFlat.default,
  coldCritDamageAbsolute: ASSUMPTIONS.coldCritDamageAbsolute.default,
  procWeightsQuantized: ASSUMPTIONS.procWeightsQuantized.default,
  falloffHeadsForZero: ASSUMPTIONS.falloffHeadsForZero.default,
};
