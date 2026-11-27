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
  /** It multiplies flat crit damage too, such as Cold's. Only with headcritScalesModded. Confirmed. */
  headcritScalesFlat: { default: true, test: 'T-5', bible: '§7' },
  /** Cold's +0.1x is added to the crit multiplier. If not: it is 10% of the base. Confirmed. */
  coldCritDamageAbsolute: { default: true, test: 'T-5', bible: '§7' },
  /** Procs pick their type by quantized damage, so a type at zero never procs. Confirmed. */
  procWeightsQuantized: { default: true, test: 'T-14', bible: '§6' },
  /** Falloff drops in a line to nothing at its end, and stops at the least. Confirmed. */
  falloffHeadsForZero: { default: true, test: 'T-26', bible: '§11' },
  /**
   * A shield a hit breaks shows the hit less what of it went on, as the shield took it: 5% of the
   * rest. If not: less the number on health. Confirmed on a Bursa: 7,137, where the other would be
   * 7,207.
   */
  breakShownInOwnTerms: { default: true, test: 'T-47', bible: '§15' },
  /**
   * Strips work from armor within its limits, at most 2,700, as the wiki's Armor page has the level
   * clamp it. If not: from the armor the level gives, and the cap after them. Confirmed: Heavy
   * Gunners at levels 60 and 100 show 111 with Corrosive Projection, where the other would be 83 and 60.
   */
  armorCappedBeforeStrips: { default: true, test: 'T-6', bible: '§10' },
  /**
   * Tau's vulnerability multiplies the status chance a hit brings (the wiki's Tau page): 30% with
   * three stacks is 30% × 1.3. If not, it adds points: 30% + 30%.
   */
  tauChanceMultiplied: { default: true, test: 'T-9', bible: '§8' },
  /**
   * A combined element's DoT, Gas, takes its components' bonuses too. If not, Gas mods alone, as the
   * wiki says. Confirmed: Aklex with Scorch and Pistol Pestilence ticks 66 Gas, not 144.
   */
  dotsTakeComponentBonuses: { default: false, test: 'T-8', bible: '§8' },
  /**
   * Electricity and Gas tick every second from the proc while it lasts: ⌈D⌉ times, as the wiki's
   * ⌊D⌋ + 1 less a tick at the very end. If not, ⌊D − 1⌋ + 1, as the DoTs that wait a second.
   * Confirmed: with +90% status duration (11.4 s), one Gas proc deals 12 ticks.
   */
  immediateDotsTickToTheEnd: { default: true, test: 'T-8', bible: '§8' },
} as const satisfies Readonly<Record<string, Assumption>>;

export type Assumptions = Readonly<Record<keyof typeof ASSUMPTIONS, boolean>>;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  bowFireRateDoubled: ASSUMPTIONS.bowFireRateDoubled.default,
  headcritScalesModded: ASSUMPTIONS.headcritScalesModded.default,
  headcritScalesFlat: ASSUMPTIONS.headcritScalesFlat.default,
  coldCritDamageAbsolute: ASSUMPTIONS.coldCritDamageAbsolute.default,
  procWeightsQuantized: ASSUMPTIONS.procWeightsQuantized.default,
  falloffHeadsForZero: ASSUMPTIONS.falloffHeadsForZero.default,
  breakShownInOwnTerms: ASSUMPTIONS.breakShownInOwnTerms.default,
  armorCappedBeforeStrips: ASSUMPTIONS.armorCappedBeforeStrips.default,
  tauChanceMultiplied: ASSUMPTIONS.tauChanceMultiplied.default,
  dotsTakeComponentBonuses: ASSUMPTIONS.dotsTakeComponentBonuses.default,
  immediateDotsTickToTheEnd: ASSUMPTIONS.immediateDotsTickToTheEnd.default,
};
