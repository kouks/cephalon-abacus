const STEPS = 32;

/** The nearest 32nd, halves up (BIBLE §6). */
export const quantize = (ratio: number): number => Math.round(ratio * STEPS) / STEPS;
