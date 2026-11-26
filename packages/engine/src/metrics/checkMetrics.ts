import type { Library } from '@abacus/data/load/library';
import type { Attack } from '@abacus/data/schema/attack';
import type { Layer } from '@abacus/data/schema/damageTypeRule';
import type { Scenario } from '@abacus/data/schema/scenario';
import type { Weapon } from '@abacus/data/schema/weapon';

import type { EnemyLeftOut, LeftOut, Warning } from '@/build/types';
import type { EnemyStats } from '@/enemy/scaleEnemy';
import { blastRadius } from '@/resolve/factors/landingFactor';
import { isInRange } from '@/resolve/factors/rangeFactor';
import { hasLayer } from '@/resolve/defence';
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

/** What an enemy takes off damage that isn't counted. The neutral dummy takes nothing off. */
const warnEnemy = ({ id }: Scenario['enemy'], { enemies }: Library): readonly Warning[] => {
  const enemy = enemies.get(id);
  const found: readonly (readonly [EnemyLeftOut, boolean])[] = [
    ['attenuation', enemy?.flags?.includes('hasAttenuation') === true],
  ];
  return found
    .filter(([, isLeftOut]) => isLeftOut)
    .map(([what]): Warning => ({ code: 'enemyLeftOut', enemyId: id, what }));
};

const warnAttack = ({ attackId }: Scenario['build'], weapon: Weapon): readonly Warning[] =>
  attackId === undefined || firingModes(weapon).some(({ id }) => id === attackId)
    ? []
    : [{ code: 'unknownAttack', attackId }];

const warnPart = ({ head, weakPoint: part = 'head' }: Scenario['aim'], { parts }: Target) =>
  head === 0 || parts.has(part) ? [] : [{ code: 'unknownPart', part } as const];

type Met = { readonly weapon: Weapon; readonly target: Target; readonly library: Library };

/** What of a scenario the metrics can't follow. */
export const checkMetrics = (
  { build, aim, enemy }: Scenario,
  { weapon, target, library }: Met,
): readonly Warning[] => [
  ...warnAttack(build, weapon),
  ...warnPart(aim, target),
  ...warnLeftOut(weapon),
  ...warnEnemy(enemy, library),
];

/** A layer the scenario names, which the enemy doesn't have at its level: the hits meet it anyway. */
export const checkLayer = (layer: Layer, stats: EnemyStats | undefined): readonly Warning[] =>
  hasLayer(layer, stats) ? [] : [{ code: 'missingLayer', layer }];

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

/** The firing modes that land beside the target, and set off nothing that gets to it. */
export const checkLanding = (
  byAttack: readonly AttackMetrics[],
  { missBy = 0 }: Scenario['aim'],
): readonly Warning[] =>
  byAttack.flatMap(({ attackId, shots }) => {
    const radius = Math.max(...shots.map(({ shot }) => blastRadius(shot.stats)));
    return missBy <= radius ? [] : [{ code: 'missesTarget', attackId, missBy, radius } as const];
  });
