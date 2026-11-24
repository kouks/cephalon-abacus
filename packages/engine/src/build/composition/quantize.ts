const STEPS = 32;

/** The nearest 32nd, halves away from zero (BIBLE §6). */
export const quantize = (ratio: number): number =>
  (Math.sign(ratio) * Math.floor(Math.abs(ratio) * STEPS + 0.5)) / STEPS;
