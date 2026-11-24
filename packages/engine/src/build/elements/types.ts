import type { DamageType } from '@abacus/data/schema/damageType';

type Equipped = {
  readonly origin: 'mod' | 'riven';
  /** The mod slot, counted from the top left. */
  readonly slotIndex: number;
};

type Unslotted = {
  readonly origin: 'innate' | 'progenitor' | 'ability';
};

/** One elemental bonus. Those of a Riven come in the order the Riven lists them. */
export type ElementSource = (Equipped | Unslotted) & {
  readonly element: DamageType;
  /** Share of the attack's total base damage. */
  readonly ratio: number;
  /** What brings it: "Hellfire", "Amprex". */
  readonly name: string;
};

/**
 * How a source found its place. `slot`: its mod slot decided. `last`: it is innate, so it came after
 * the mods. `joined`: its element was already placed. `apart`: it never combines.
 */
export type Placement = 'slot' | 'last' | 'joined' | 'apart';

export type PlacedSource = ElementSource & { readonly placement: Placement };

/** Sources of one element that count together. */
export type ElementPart = {
  readonly element: DamageType;
  readonly ratio: number;
  readonly sources: readonly PlacedSource[];
};

/** An element the attack deals, and the parts that made it: Viral from Cold and Toxin. */
export type FinalElement = {
  readonly element: DamageType;
  readonly ratio: number;
  readonly parts: readonly ElementPart[];
};

export type CombinedElements = {
  readonly ratios: ReadonlyMap<DamageType, number>;
  /** Why each element formed, in the order they did. */
  readonly explanation: readonly FinalElement[];
};
