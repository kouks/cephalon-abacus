import type { ConditionalState } from '@abacus/data/schema/conditionals';
import type { Trigger } from '@abacus/data/schema/condition';
import type { Effect, Op, Variable } from '@abacus/data/schema/effect';

/** Where an effect comes from: a module, or the weapon itself. */
export type Source = { readonly id: string; readonly name: string };

/** An effect of the build, scaled by rank. Stacks and the other variables still multiply it. */
export type CollectedEffect = Omit<Effect, 'value'> & {
  readonly source: Source;
  readonly value: number;
  readonly times: readonly Variable[];
};

/** One switch: the effects of one source on one trigger. */
export type Conditional = {
  readonly key: string;
  readonly source: Source;
  readonly trigger: Trigger;
  readonly state: ConditionalState;
  readonly maxStacks: number;
  /** The stacks it starts with. */
  readonly stacks: number;
};

/** Something about the build that doesn't work as written. The result is still usable. */
export type Warning =
  | { readonly code: 'unknownModule'; readonly moduleId: string }
  | { readonly code: 'duplicateModule'; readonly moduleId: string }
  | { readonly code: 'exclusiveGroup'; readonly moduleId: string; readonly keptId: string }
  | {
      readonly code: 'rankAboveMax';
      readonly moduleId: string;
      readonly rank: number;
      readonly max: number;
    }
  | {
      readonly code: 'lockedBucket';
      readonly sourceId: string;
      readonly bucket: string;
      readonly lockedBy: string;
    }
  | {
      readonly code: 'stacksAboveMax';
      readonly sourceId: string;
      readonly trigger: Trigger;
      readonly stacks: number;
      readonly max: number;
    }
  | { readonly code: 'unusedOverride'; readonly sourceId: string; readonly trigger: Trigger }
  | { readonly code: 'unusedElement'; readonly sourceId: string }
  | { readonly code: 'noProgenitor'; readonly weaponId: string };

/** Everything a build's modules bring, before stacks, filters and sums. */
export type Collected = {
  readonly effects: readonly CollectedEffect[];
  readonly conditionals: readonly Conditional[];
  readonly warnings: readonly Warning[];
};

/** What one effect adds to its bucket: "Serration: +165% damage.base". */
export type Contribution = {
  readonly source: Source;
  readonly bucket: string;
  readonly op: Op;
  readonly value: number;
  /** For a conditional: how it was switched, and the stacks it counted with. */
  readonly conditional?: {
    readonly trigger: Trigger;
    readonly stacks: number;
    readonly maxStacks: number;
  };
};
