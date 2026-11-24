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
} as const satisfies Readonly<Record<string, Assumption>>;

export type Assumptions = Readonly<Record<keyof typeof ASSUMPTIONS, boolean>>;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  bowFireRateDoubled: ASSUMPTIONS.bowFireRateDoubled.default,
};
