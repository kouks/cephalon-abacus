import type { LibraryFile } from '@abacus/data/load/readItems';

/** The only path out of the package: a glob can't go through the data package's exports. */
const texts = import.meta.glob<string>('../../../data/library/**/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The library as it was built into the app. */
export const libraryFiles: readonly LibraryFile[] = Object.entries(texts).map(([file, text]) => ({
  path: file.slice(file.indexOf('/library/') + '/library/'.length),
  text,
}));
