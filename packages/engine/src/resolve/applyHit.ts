import { must } from '@abacus/data/assert';
import type { DamageType } from '@abacus/data/schema/damageType';
import type { Layer } from '@abacus/data/schema/damageTypeRule';
import { LAYERS } from '@abacus/data/schema/damageTypeRule';

/** What an enemy has left of each layer. */
export type LayersLeft = Readonly<Record<Layer, number>>;

/** One hit's damage per type on each layer, as if it met that layer alone. */
export type LayeredHit = Readonly<Record<Layer, ReadonlyMap<DamageType, number>>>;

/** What one hit did to one layer: the number the game shows, and what the layer lost (BIBLE §15). */
export type Dealt = { readonly layer: Layer; readonly shown: number; readonly applied: number };

export type Applied = { readonly dealt: readonly Dealt[]; readonly left: LayersLeft };

/** Of what is left of a hit that breaks shields, this share reaches health (BIBLE §10, T-38). */
export const SHIELD_GATE = 0.05;

type Options = {
  /** Weak points bypass the shield gate (BIBLE §10). */
  readonly isWeakPoint: boolean;
  /** The assumption `breakShownInOwnTerms` (T-44). */
  readonly isShownInOwnTerms: boolean;
};

type Context = { readonly hit: LayeredHit; readonly options: Options };

/** How much of a type still has to land, and the layer it last broke through. */
type Share = { readonly share: number; readonly brokeAt?: Layer };

type Carry = ReadonlyMap<DamageType, Share>;

type Step = {
  readonly layer: Layer;
  readonly damage: number;
  readonly applied: number;
  /** What of the hit went on, as this layer took it. */
  readonly wentOn: number;
  /** What of the damage came through the break of each layer before. */
  readonly throughBreaks: ReadonlyMap<Layer, number>;
};

const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

/** What is left of a hit that breaks a layer goes on: all of it, but 5% past shields. */
const passOn = (layer: Layer, { isWeakPoint }: Options) =>
  layer === 'shield' && !isWeakPoint ? SHIELD_GATE : 1;

/** The types that hit a layer wear it down; those that skip it (Toxin, shields) go on as they are. */
const meet = (
  layer: Layer,
  carry: Carry,
  { hit, options, left }: Context & { readonly left: number },
) => {
  const damageOf = (type: DamageType, { share }: Share) => share * (hit[layer].get(type) ?? 0);
  const entries = [...carry];
  const total = sum(entries.map(([type, share]) => damageOf(type, share)));
  const isBroken = layer !== 'health' && total > left;
  const rest = isBroken ? (1 - left / total) * passOn(layer, options) : 0;
  const next: Carry = new Map(
    entries.map(([type, entry]): [DamageType, Share] =>
      damageOf(type, entry) > 0
        ? [type, { share: entry.share * rest, brokeAt: layer }]
        : [type, entry],
    ),
  );
  const wentOn = isBroken ? (total - left) * passOn(layer, options) : 0;
  return { total, applied: Math.min(total, left), next, wentOn };
};

const throughBreaksOf = (layer: Layer, carry: Carry, hit: LayeredHit) => {
  const byLayer = new Map<Layer, number>();
  for (const [type, { share, brokeAt }] of carry) {
    if (brokeAt === undefined) continue;
    byLayer.set(brokeAt, (byLayer.get(brokeAt) ?? 0) + share * (hit[layer].get(type) ?? 0));
  }
  return byLayer;
};

/** What of the hit a layer doesn't show: what went on, as it took it or as the later layers show it. */
const furtherOf = (steps: readonly Step[], index: number, isShownInOwnTerms: boolean) => {
  const { layer, wentOn } = must(steps[index], 'A step of the hit');
  if (isShownInOwnTerms) return wentOn;
  return sum(steps.slice(index + 1).map(({ throughBreaks }) => throughBreaks.get(layer) ?? 0));
};

/** A layer the hit broke shows the hit less what of it went on (BIBLE §15, T-44). */
const dealtOf = (steps: readonly Step[], { isShownInOwnTerms }: Options): readonly Dealt[] =>
  steps
    .map(({ layer, damage, applied }, index) => {
      const further = furtherOf(steps, index, isShownInOwnTerms);
      return { layer, shown: Math.round(damage) - Math.round(further), applied };
    })
    .filter(({ applied }) => applied > 0);

/**
 * One hit on an enemy's layers, in order: Overguard, shields, health (BIBLE §10). A layer that is gone
 * is skipped; a hit that breaks one goes on with what is left of it.
 */
export const applyHit = (left: LayersLeft, hit: LayeredHit, options: Options): Applied => {
  let carry: Carry = new Map([...hit.health.keys()].map((type) => [type, { share: 1 }]));
  const remaining: Record<Layer, number> = { ...left };
  const steps: Step[] = [];
  for (const layer of LAYERS) {
    if (layer !== 'health' && remaining[layer] <= 0) continue;
    const throughBreaks = throughBreaksOf(layer, carry, hit);
    const met = meet(layer, carry, { hit, options, left: remaining[layer] });
    remaining[layer] -= met.applied;
    const { total: damage, applied, wentOn } = met;
    steps.push({ layer, damage, applied, wentOn, throughBreaks });
    carry = met.next;
  }
  return { dealt: dealtOf(steps, options), left: remaining };
};
