import { formatError } from '#data/load/libraryError.ts';
import { loadLibrary } from '#data/load/loadLibrary.ts';

import { readLibrary } from './readLibrary.ts';

/** The library on disk, or an error that lists what is wrong with it. */
export const loadRealLibrary = () => {
  const result = loadLibrary(readLibrary());
  if (!result.ok) throw new Error(result.errors.map(formatError).join('\n'));
  return result.library;
};
