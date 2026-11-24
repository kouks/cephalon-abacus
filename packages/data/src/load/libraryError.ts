import { z } from 'zod';

/** One thing wrong with the library, and where. */
export type LibraryError = {
  /** The file, from the library folder: "weapons/rifles.json". */
  readonly file: string;
  /** Where in the file: "items[2].attacks[0].critChance". Empty for the file itself. */
  readonly path: string;
  readonly message: string;
};

type Path = readonly PropertyKey[];

export const errorAt = (file: string, path: Path, message: string): LibraryError => ({
  file,
  path: z.core.toDotPath(path),
  message,
});

/** A failed validation as library errors, under `prefix`. */
export const errorsFrom = (
  file: string,
  prefix: Path,
  error: z.ZodError,
): readonly LibraryError[] =>
  error.issues.map((issue) => errorAt(file, [...prefix, ...issue.path], issue.message));

export const formatError = ({ file, path, message }: LibraryError) =>
  path === '' ? `${file}: ${message}` : `${file}: ${path}: ${message}`;
