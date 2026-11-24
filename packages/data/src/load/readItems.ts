import type { z } from 'zod';

import { envelopeSchema } from '@/schema/envelope';

import type { LibraryError } from './libraryError';
import { errorAt, errorsFrom } from './libraryError';

/** A library file as it is on disk. The path starts at the library folder. */
export type LibraryFile = { readonly path: string; readonly text: string };

/** A valid item and where it came from. */
export type Located<Item> = {
  readonly item: Item;
  readonly file: string;
  readonly index: number;
};

export type Items<Item> = {
  readonly items: readonly Located<Item>[];
  readonly errors: readonly LibraryError[];
};

type Parsed = { readonly value: unknown } | { readonly reason: string };

const parseJson = (text: string): Parsed => {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : 'Not JSON' };
  }
};

const failed = (errors: readonly LibraryError[]) => ({ items: [], errors });

const readFile = <Item>(schema: z.ZodType<Item>, { path, text }: LibraryFile): Items<Item> => {
  const parsed = parseJson(text);
  if ('reason' in parsed) return failed([errorAt(path, [], `Not valid JSON: ${parsed.reason}`)]);

  const envelope = envelopeSchema.safeParse(parsed.value);
  if (!envelope.success) return failed(errorsFrom(path, [], envelope.error));

  const items: Located<Item>[] = [];
  const errors: LibraryError[] = [];
  for (const [index, raw] of envelope.data.items.entries()) {
    const result = schema.safeParse(raw);
    if (result.success) items.push({ item: result.data, file: path, index });
    else errors.push(...errorsFrom(path, ['items', index], result.error));
  }
  return { items, errors };
};

/** Validates every item of the files. A bad item doesn't hide the errors of the others. */
export const readItems = <Item>(
  schema: z.ZodType<Item>,
  files: readonly LibraryFile[],
): Items<Item> => {
  const results = files.map((file) => readFile(schema, file));
  return {
    items: results.flatMap(({ items }) => items),
    errors: results.flatMap(({ errors }) => errors),
  };
};
