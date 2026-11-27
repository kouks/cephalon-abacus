import type { DamageTypeRule } from '@/schema/damageTypeRule';
import type { Weapon } from '@/schema/weapon';

import type { Library } from './library';
import type { LibraryError } from './libraryError';
import { errorAt } from './libraryError';
import { STATUSES_FILE } from './places';
import type { Located } from './readItems';

const missing = (status: string) => `No status "${status}" in ${STATUSES_FILE}`;

/** Every status a damage type procs is in statuses.json. */
const checkProcs = (
  located: readonly Located<DamageTypeRule>[],
  { statuses }: Pick<Library, 'statuses'>,
): readonly LibraryError[] =>
  located.flatMap(({ item, file, index }) =>
    item.proc === undefined || statuses.has(item.proc)
      ? []
      : [errorAt(file, ['items', index, 'proc'], missing(item.proc))],
  );

/** Every status an attack always inflicts is in statuses.json. */
const checkForced = (
  located: readonly Located<Weapon>[],
  { statuses }: Pick<Library, 'statuses'>,
): readonly LibraryError[] =>
  located.flatMap(({ item, file, index }) =>
    item.attacks.flatMap((attack, at) =>
      (attack.forcedProcs ?? []).flatMap(({ status }, forced) =>
        statuses.has(status)
          ? []
          : [
              errorAt(
                file,
                ['items', index, 'attacks', at, 'forcedProcs', forced, 'status'],
                missing(status),
              ),
            ],
      ),
    ),
  );

/** The statuses that damage types and attacks name are all in statuses.json. */
export const checkStatuses = (
  found: {
    readonly damageTypes: readonly Located<DamageTypeRule>[];
    readonly weapons: readonly Located<Weapon>[];
  },
  library: Pick<Library, 'statuses'>,
): readonly LibraryError[] => [
  ...checkProcs(found.damageTypes, library),
  ...checkForced(found.weapons, library),
];
