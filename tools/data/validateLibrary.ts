/**
 * Fails while library files exist that nothing validates. ABA-6 replaces this with the loader.
 */
import { globSync } from 'node:fs';

const files = globSync('packages/data/library/**/*.json');

if (files.length > 0) {
  console.error(`No loader yet (ABA-6), so these files are unchecked:\n${files.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('The library has no files yet.');
}
