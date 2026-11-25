import { z } from 'zod';

import { damageTypeSchema } from './damageType';
import { object, positive, positiveInt } from './primitives';

const namedTriggerSchema = z.enum([
  'always',
  'onKill',
  'onHeadshot',
  'onWeakPointHit',
  'onWeakPointKill',
  'onCrit',
  'onReload',
  'onShieldBreak',
  'perStatusTypeOnTarget',
  'perComboTier',
  'whileAiming',
  'incarnonFormActive',
]);

export const triggerSchema = z.union(
  [namedTriggerSchema, z.templateLiteral(['onStatus:', damageTypeSchema])],
  { error: 'Expected a trigger, e.g. "onKill" or "onStatus:cold"' },
);

/** When an effect applies (BIBLE §13). Fields only: the engine gives them meaning. */
export const conditionSchema = object({
  trigger: triggerSchema,
  target: z.enum(['self', 'enemy']),
  stacks: object({
    max: positiveInt,
    perTrigger: positiveInt,
    /** Whether a stack timer running out removes every stack or one. */
    decay: z.enum(['all', 'one']),
    duration: positive,
  }).exactOptional(),
});

export type Trigger = z.infer<typeof triggerSchema>;
export type Condition = z.infer<typeof conditionSchema>;
