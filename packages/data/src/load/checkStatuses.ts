import type { DamageTypeRule } from '@/schema/damageTypeRule';

import type { Library } from './library';
import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import { STATUSES_FILE } from './places';
import type { Located } from './readItems';

/** Every status a damage type procs is in statuses.json. */
export const checkStatuses = (
  located: readonly Located<DamageTypeRule>[],
  { statuses }: Pick<Library, 'statuses'>,
): readonly LibraryError[] =>
  located.flatMap(({ item, file, index }) =>
    item.proc === undefined || statuses.has(item.proc)
      ? []
      : [errorAt(file, ['items', index, 'proc'], `No status "${item.proc}" in ${STATUSES_FILE}`)],
  );
