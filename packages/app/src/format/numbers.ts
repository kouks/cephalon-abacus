const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const precise = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

/** As the game shows it: 12,345. */
export const formatDamage = (damage: number): string =>
  Number.isFinite(damage) ? whole.format(damage) : 'Unlimited';

/** 2.2x. */
export const formatMultiplier = (multiplier: number): string => `${precise.format(multiplier)}x`;

const signed = (value: number, text: string) => (value < 0 ? text : `+${text}`);

/** +165%, -20%. */
export const formatBonus = (value: number): string => signed(value, percent.format(value));

/** +0.5, for what is added as it is. */
export const formatFlat = (value: number): string => signed(value, precise.format(value));
