import type { Attack } from '@abacus/data/schema/attack';
import type { Scenario } from '@abacus/data/schema/scenario';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { LeftOut, Warning } from '@/build/types';
import { isInRange } from '@/resolve/factors/rangeFactor';
import type { Target } from '@/resolve/target';

import type { AttackMetrics } from './attackMetrics';
import { firingModes, withLinked } from './firingModes';

const leftOutOf = (attack: Attack, weapon: Weapon): readonly LeftOut[] => {
  const found: readonly (readonly [LeftOut, boolean])[] = [
    ['beamRamp', attack.beam !== undefined],
    ['spoolUp', attack.spool !== undefined],
    ['sniperCombo', weapon.sniperCombo !== undefined],
    ['zoom', weapon.zoomLevels !== undefined],
  ];
  return found.filter(([, isLeftOut]) => isLeftOut).map(([what]) => what);
};

/** What the closed form doesn't count: a beam's ramp-up is for the timeline (ABA-26). */
const warnLeftOut = (weapon: Weapon): readonly Warning[] =>
  firingModes(weapon)
    .flatMap((mode) => withLinked(mode, weapon))
    .flatMap((attack) =>
      leftOutOf(attack, weapon).map((what): Warning => ({
        code: 'leftOut',
        attackId: attack.id,
        what,
      })),
    );

const warnAttack = ({ attackId }: Scenario['build'], weapon: Weapon): readonly Warning[] =>
  attackId === undefined || firingModes(weapon).some(({ id }) => id === attackId)
    ? []
    : [{ code: 'unknownAttack', attackId }];

const warnPart = ({ head, weakPoint: part = 'head' }: Scenario['aim'], { parts }: Target) =>
  head === 0 || parts.has(part) ? [] : [{ code: 'unknownPart', part } as const];

/** What of a scenario the metrics can't follow. */
export const checkMetrics = (
  { build, aim }: Scenario,
  weapon: Weapon,
  target: Target,
): readonly Warning[] => [
  ...warnAttack(build, weapon),
  ...warnPart(aim, target),
  ...warnLeftOut(weapon),
];

/** The firing modes that don't reach the target, and deal nothing to it. */
export const checkRange = (
  byAttack: readonly AttackMetrics[],
  distance: number,
): readonly Warning[] =>
  byAttack.flatMap(({ attackId, stats: { range } }) =>
    range === undefined || isInRange(range, distance)
      ? []
      : [{ code: 'outOfRange', attackId, range: range.value, distance } as const],
  );
