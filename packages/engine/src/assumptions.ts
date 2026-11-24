/** An open [T] rule: what the engine assumes until the named in-game test settles it. */
export type Assumption = {
  readonly default: boolean;
  /** The in-game test that settles it (BIBLE §16). */
  readonly test: `T-${number}`;
  /** The BIBLE section that states the rule. */
  readonly bible: `§${number}`;
};

/** Every open [T] rule the engine reads. Each is added by the ticket whose code first needs it. */
export const ASSUMPTIONS: Readonly<Record<string, Assumption>> = {};
