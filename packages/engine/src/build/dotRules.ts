import type { Library } from '@abacus/data/load/library';
import type { DamageType } from '@abacus/data/schema/damageType';
import type { Dot } from '@abacus/data/schema/status';

import type { Assumptions } from '@/assumptions';

/** How a status ticks, with what of the library a tick needs (BIBLE §8). */
export type DotRule = Omit<Dot, 'scaledBy'> & {
  readonly status: string;
  /** Seconds a stack lasts, before status duration bonuses. */
  readonly duration: number;
  /** The elements whose bonuses raise its ticks. */
  readonly elements: readonly DamageType[];
  /** The type that procs it, whose faction weakness it may take (T-8). */
  readonly procType?: DamageType;
};

type Reference = Pick<Library, 'statuses' | 'damageTypes'>;

/** Its own element, and that element's two components if the assumption says so (T-8). */
const elementsOf = (
  { scaledBy }: Dot,
  { damageTypes }: Reference,
  { dotsTakeComponentBonuses }: Assumptions,
): readonly DamageType[] => {
  if (scaledBy === undefined) return [];
  const components = damageTypes.get(scaledBy)?.combinesFrom ?? [];
  return [scaledBy, ...(dotsTakeComponentBonuses ? components : [])];
};

const procTypeOf = (status: string, { damageTypes }: Reference) =>
  [...damageTypes.values()].find(({ proc }) => proc === status)?.id;

/** Every status that ticks, by its id. */
export const dotRulesOf = (
  library: Reference,
  assumptions: Assumptions,
): ReadonlyMap<string, DotRule> =>
  new Map(
    [...library.statuses.values()].flatMap(({ id, dot, duration }) => {
      if (dot === undefined || duration === undefined) return [];
      const { coefficient, delay, dealsAs, reach } = dot;
      const procType = procTypeOf(id, library);
      const rule: DotRule = {
        coefficient,
        delay,
        dealsAs,
        ...(reach === undefined ? {} : { reach }),
        status: id,
        duration,
        elements: elementsOf(dot, library, assumptions),
        ...(procType === undefined ? {} : { procType }),
      };
      return [[id, rule] as const];
    }),
  );
