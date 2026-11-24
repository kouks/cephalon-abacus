import { z } from 'zod';

/** An object that refuses unknown keys, so a misspelt field is an error and not a silent default. */
export const object = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.strictObject(shape).readonly();

export const list = <Item extends z.ZodType>(item: Item) => z.array(item).readonly();

/** A stable lower-kebab id. Never change one: fixtures and saved builds point at it. */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lower-kebab id, e.g. "primed-bane"');

/** The game version an item was checked against, e.g. "44.1.4.1". */
export const gameVersionSchema = z
  .string()
  .regex(/^\d+(?:\.\d+)*$/, 'Expected a game version, e.g. "44.1.4.1"');

const isFandom = (url: string) => /^https:\/\/(?:[\w-]+\.)*fandom\.com(?:[/:]|$)/i.test(url);

export const sourceSchema = z
  .url({ protocol: /^https$/, error: 'Expected an https URL' })
  .refine((url) => !isFandom(url), 'The Fandom wiki is stale; cite wiki.warframe.com');

/** Names a hook in the registry, e.g. "weapon.kohm.spool" (BIBLE §14). */
export const hookRefSchema = z
  .string()
  .regex(/^[a-z]+(?:\.[a-z0-9-]+)+$/, 'Expected a hook id, e.g. "weapon.kohm.spool"');

export const nonNegative = z.number().nonnegative();
export const positive = z.number().positive();
export const positiveInt = z.int().positive();
export const nonNegativeInt = z.int().nonnegative();

/** What every library item carries. */
export const itemShape = {
  id: slugSchema,
  name: z.string().min(1),
  /** DE's path, stable across renames. */
  uniqueName: z.string().startsWith('/Lotus/').exactOptional(),
  source: sourceSchema,
  gameVersion: gameVersionSchema,
};

export type HookRef = z.infer<typeof hookRefSchema>;
