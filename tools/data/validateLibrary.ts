import { formatError } from '#data/load/libraryError.ts';
import { loadLibrary } from '#data/load/loadLibrary.ts';

import { readLibrary } from './readLibrary.ts';

const files = readLibrary();
const result = loadLibrary(files);

if (result.ok) {
  const { weapons, modules, enemies } = result.library;
  const counts = `${weapons.size} weapons, ${modules.size} modules, ${enemies.size} enemies`;
  console.log(`The library is valid: ${files.length} files, ${counts}.`);
} else {
  for (const error of result.errors) console.error(formatError(error));
  console.error(`\n${result.errors.length} errors in the library.`);
  process.exitCode = 1;
}
