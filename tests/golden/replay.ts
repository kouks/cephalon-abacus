import { must } from '@abacus/data/assert';
import type { Layer } from '@abacus/data/schema/damageTypeRule';
import type { Colour } from '@abacus/data/schema/goldenFixture';
import type { Scenario } from '@abacus/data/schema/scenario';
import { COLOURS } from '@abacus/data/schema/goldenFixture';
import type { LayersLeft, Result, TierDealt } from '@abacus/engine';

/** A case's result, and the same scenario evaluated again on an enemy with less left. */
export type Run = {
  readonly result: Result;
  readonly again: (left: LayersLeft, layer?: Layer) => Result;
};

/** The one hit a fixture aims: the headline shot's own, on one part. */
const hitOf = ({ byAttack, attackId }: Result) => {
  const attack = must(
    byAttack.find((entry) => entry.attackId === attackId),
    'The headline is of a firing mode',
  );
  const hits = must(attack.shots[0], 'A firing mode has a shot').shot.hits;
  if (hits.length !== 1) throw new Error('A fixture aims at one part');
  return must(hits[0], 'The shot has a hit');
};

const tierOf = (colour: Colour) => COLOURS.indexOf(colour);

/** What one hit of a colour shows and applies on the enemy as the result has it. */
export const dealtOf = (result: Result, colour: Colour): TierDealt =>
  must(
    hitOf(result).dealt.find(({ tier }) => tier === tierOf(colour)),
    `No ${colour} hit can happen at this crit chance`,
  );

/** What a hit of a colour deals to a layer, whatever is in its way. */
export const damageOn = (run: Run, left: LayersLeft, { layer, colour }: Aimed): number =>
  must(
    hitOf(run.again(left, layer)).hit.tiers.find(({ tier }) => tier === tierOf(colour)),
    `No ${colour} hit can happen at this crit chance`,
  ).total;

type Aimed = { readonly layer: Layer; readonly colour: Colour };

/** The result on an enemy with this much left: the case's own if it is fresh. */
const resultAt = (run: Run, left: LayersLeft | undefined) =>
  left === undefined ? run.result : run.again(left);

/** Hits one after another, as the engine applies them: what is left after them. */
export const replay = (
  run: Run,
  from: LayersLeft | undefined,
  colours: readonly Colour[],
): LayersLeft | undefined =>
  colours.reduce<LayersLeft | undefined>(
    (left, colour) => dealtOf(resultAt(run, left), colour).left,
    from,
  );

/** The hits by colour, in the order of the colours. */
export const inOrder = (hits: Readonly<Partial<Record<Colour, number>>>): readonly Colour[] =>
  COLOURS.flatMap((colour) => Array.from({ length: hits[colour] ?? 0 }, () => colour));

/** The case's enemy with this much left, meeting this layer, or the first it has left. */
export const enemyWith = (
  { id, level, steelPath, modifiers }: Scenario['enemy'],
  left: LayersLeft,
  layer?: Layer,
): Scenario['enemy'] => ({
  id,
  level,
  steelPath,
  modifiers,
  left,
  ...(layer === undefined ? {} : { layer }),
});
