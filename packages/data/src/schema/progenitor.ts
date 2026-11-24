import { z } from 'zod';

import { damageTypeSchema } from './damageType';
import { object } from './primitives';

/** The bonus element of a Kuva, Tenet or Coda weapon (BIBLE §14). */
export const progenitorSchema = object({
  element: damageTypeSchema,
  /** Share of base damage. Valence Fusion caps it at 60%. */
  pct: z.number().min(0.25).max(0.6),
});

export type Progenitor = z.infer<typeof progenitorSchema>;
