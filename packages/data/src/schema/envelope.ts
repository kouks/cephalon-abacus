import { z } from 'zod';

import { gameVersionSchema, list, object, sourceSchema } from './primitives';

export const SCHEMA_VERSION = 1;

/** What every library file looks like. Its items are validated one by one, by the loader. */
export const envelopeSchema = object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  gameVersion: gameVersionSchema,
  source: sourceSchema,
  items: list(z.unknown()),
});

export type Envelope = z.infer<typeof envelopeSchema>;
