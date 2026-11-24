import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import type { Located } from './readItems';

type WithId = { readonly id: string };

/** Ids are unique across all the files of a collection. */
export const findDuplicateIds = (located: readonly Located<WithId>[]): readonly LibraryError[] => {
  const firstUse = new Map<string, Located<WithId>>();
  return located.flatMap((entry) => {
    const first = firstUse.get(entry.item.id);
    if (first === undefined) {
      firstUse.set(entry.item.id, entry);
      return [];
    }
    const where = `${first.file}: items[${first.index}]`;
    const path = ['items', entry.index, 'id'];
    return [errorAt(entry.file, path, `The id "${entry.item.id}" is already used by ${where}`)];
  });
};
