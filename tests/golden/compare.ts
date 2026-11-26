import { must } from '@abacus/data/assert';
import { DAMAGE_TYPES } from '@abacus/data/schema/damageType';
import { COLOURS } from '@abacus/data/schema/goldenFixture';
import type { Colour, Observed, Tolerance } from '@abacus/data/schema/goldenFixture';
import type { AttackMetrics } from '@abacus/engine';

import type { Comparison } from './comparison';
import { compareDepleted } from './depleted';
import { compareLayered } from './layered';
import type { Run } from './replay';
import { explainHit } from './explain';

type Side = {
  readonly attack: AttackMetrics;
  readonly tolerance: Tolerance;
  readonly hitsOf?: string | undefined;
};

/** The observed keys of a list, each with its value. */
const observedIn = <Key extends string>(
  keys: readonly Key[],
  map: Readonly<Partial<Record<Key, number>>> | undefined,
): readonly (readonly [Key, number])[] =>
  keys.flatMap((key) => {
    const value = map?.[key];
    return value === undefined ? [] : [[key, value] as const];
  });

/** The one part that a fixture aims at, hit by the shot or by what it sets off. */
const hitOf = ({ shots, attackId }: AttackMetrics, hitsOf = attackId) => {
  const fired = shots.find((entry) => entry.attackId === hitsOf);
  const { hits } = must(fired, `The shot sets off no "${hitsOf}"`).shot;
  if (hits.length !== 1) throw new Error('A fixture aims at one part');
  return must(hits[0], 'The shot has a hit').hit;
};

const compareHit = (
  colour: Colour,
  observed: number,
  { attack, tolerance, hitsOf }: Side,
): Comparison => {
  const hit = hitOf(attack, hitsOf);
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
  run: Run,
  tolerance: Tolerance,
): readonly Comparison[] => {
  const { byAttack, attackId } = run.result;
  const found = byAttack.find((attack) => attack.attackId === attackId);
  const attack = must(found, 'The headline is of a firing mode');
  const side = { attack, tolerance, hitsOf: observed.hitsOf };
  return [
    ...observedIn(COLOURS, observed.hits).map(([colour, value]) => compareHit(colour, value, side)),
    ...compareArsenal(observed, side),
    ...compareTotal(observed.arsenalTotal, side),
    ...compareFiring(observed, side),
    ...compareProcs(observed, side),
    ...compareDepleted(observed, run),
    ...compareLayered(observed, run, tolerance),
  ];
};
