import { z } from 'zod';

import { damageTypeSchema } from './damageType';
import { itemShape, object, positive, slugSchema } from './primitives';

/** A faction: what it is weak to, and which faction mods work on it (BIBLE §10). */
export const factionSchema = object({
  ...itemShape,
  /** Damage multipliers by type. Absent types are neutral. */
  damageProfile: z.partialRecord(damageTypeSchema, positive).readonly(),
  /** The faction bonuses it takes: Kuva Grineer take Grineer ones. Absent: only universal ones. */
  factionModGroup: slugSchema.exactOptional(),
});

export type Faction = z.infer<typeof factionSchema>;
