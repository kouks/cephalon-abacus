import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { LibraryFile } from '#data/load/readItems.ts';

const LIBRARY = path.resolve(import.meta.dirname, '../../packages/data/library');

/** Every library file on disk. */
export const readLibrary = (): readonly LibraryFile[] =>
  globSync('**/*.json', { cwd: LIBRARY })
    .sort()
    .map((file) => ({
      path: file.replaceAll('\\', '/'),
      text: readFileSync(path.join(LIBRARY, file), 'utf8'),
    }));
