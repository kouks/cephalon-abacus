import { must } from '@abacus/data/assert';
import { DAMAGE_TYPES } from '@abacus/data/schema/damageType';
import { COLOURS } from '@abacus/data/schema/goldenFixture';
import type { Colour, Observed, Tolerance } from '@abacus/data/schema/goldenFixture';
import type { AttackMetrics, Result } from '@abacus/engine';

import { explainHit } from './explain';

/** One observed value against the engine's. */
export type Comparison = {
  readonly what: string;
  readonly observed: number;
  readonly computed: number | undefined;
  readonly tolerance: number;
  /** What to look at if they differ. */
  readonly explain?: () => string;
};

type Side = { readonly attack: AttackMetrics; readonly tolerance: Tolerance };

/** The observed keys of a list, each with its value. */
const observedIn = <Key extends string>(
  keys: readonly Key[],
  map: Readonly<Partial<Record<Key, number>>> | undefined,
): readonly (readonly [Key, number])[] =>
  keys.flatMap((key) => {
    const value = map?.[key];
    return value === undefined ? [] : [[key, value] as const];
  });

/** The one part that a fixture aims at. */
const hitOf = ({ shots }: AttackMetrics) => {
  const [first] = shots;
  const hits = first?.shot.hits ?? [];
  if (hits.length !== 1) throw new Error('A fixture aims at one part');
  return must(hits[0], 'The shot has a hit').hit;
};

const compareHit = (colour: Colour, observed: number, { attack, tolerance }: Side): Comparison => {
  const hit = hitOf(attack);
  const tier = hit.tiers.find((entry) => entry.tier === COLOURS.indexOf(colour));
  const comparison = {
    what: `${colour} hit`,
    observed,
    computed: tier?.total,
    tolerance: tolerance.hits ?? 0,
  };
  return tier === undefined
    ? { ...comparison, explain: () => `No ${colour} hit can happen at this crit chance` }
    : { ...comparison, explain: () => explainHit(hit, tier.total, observed) };
};

/** The arsenal's total counts every pellet, and its types don't. */
const compareTotal = (observed: number | undefined, { attack, tolerance }: Side) => {
  if (observed === undefined) return [];
  const { composition, stats } = attack;
  const raw = [...composition.types.values()].reduce((sum, { ratio }) => sum + ratio, 0);
  const computed = raw * composition.moddedBase.value * stats.multishot.value;
  return [{ what: 'arsenal total', observed, computed, tolerance: tolerance.arsenal ?? 0 }];
};

const compareArsenal = (observed: Observed, { attack, tolerance }: Side): readonly Comparison[] => {
  const { composition, stats } = attack;
  const within = tolerance.arsenal ?? 0;
  const damage = observedIn(DAMAGE_TYPES, observed.arsenalDamage).map(
    ([type, value]): Comparison => {
      const ratio = composition.types.get(type)?.ratio;
      const computed = ratio === undefined ? undefined : ratio * composition.moddedBase.value;
      return { what: `arsenal ${type}`, observed: value, computed, tolerance: within };
    },
  );
  const byName = new Map(Object.entries(stats));
  const others = Object.entries(observed.arsenal ?? {}).map(([name, value]): Comparison => {
    const computed = byName.get(name)?.value;
    return { what: `arsenal ${name}`, observed: value, computed, tolerance: within };
  });
  return [...damage, ...others];
};

const compareFiring = ({ firing = [] }: Observed, { attack, tolerance }: Side) =>
  firing.map(({ shots, seconds }): Comparison => {
    const { effectiveFireRate, shotsPerMagazine } = attack.rates;
    const count = shots === 'magazine' ? shotsPerMagazine : shots;
    return {
      what: `seconds for ${shots === 'magazine' ? 'a magazine' : `${shots} shots`}`,
      observed: seconds,
      computed: count / effectiveFireRate,
      tolerance: tolerance.seconds ?? 0,
    };
  });

const compareProcs = ({ neverProcs = [] }: Observed, { attack }: Side) =>
  neverProcs.map((type): Comparison => {
    const computed = attack.composition.procWeights.get(type) ?? 0;
    return { what: `${type} proc weight`, observed: 0, computed, tolerance: 0 };
  });

/** Everything that was observed, against what the engine computes. */
export const compare = (
  observed: Observed,
  { byAttack, attackId }: Result,
  tolerance: Tolerance,
): readonly Comparison[] => {
  const found = byAttack.find((attack) => attack.attackId === attackId);
  const side = { attack: must(found, 'The headline is of a firing mode'), tolerance };
  return [
    ...observedIn(COLOURS, observed.hits).map(([colour, value]) => compareHit(colour, value, side)),
    ...compareArsenal(observed, side),
    ...compareTotal(observed.arsenalTotal, side),
    ...compareFiring(observed, side),
    ...compareProcs(observed, side),
  ];
};

export const isMatch = ({ observed, computed, tolerance }: Comparison): boolean =>
  computed !== undefined && Math.abs(computed - observed) <= tolerance + 1e-9;

/** One line per value that differs, and what to look at. */
export const describeMismatch = (comparison: Comparison): string => {
  const { what, observed, computed, explain } = comparison;
  const shown = computed === undefined ? 'nothing' : Number(computed.toPrecision(8));
  const line = `${what}: reported ${observed}, computed ${shown}`;
  return explain === undefined ? line : `${line}\n${explain()}`;
};
