import { must } from '@abacus/data/assert';
import type { Layer } from '@abacus/data/schema/damageTypeRule';
import { LAYERS } from '@abacus/data/schema/damageTypeRule';

import type { BuiltAttack } from '@/build/buildAttack';

import type { Applied } from './applyHit';
import { applyHit } from './applyHit';
import type { TierChance } from './crit/critTiers';
import type { Defence } from './defence';
import type { HitResult } from './resolveHit';
import { resolveHit } from './resolveHit';

/** What a hit of one crit tier shows and applies on the enemy as it is (BIBLE §15). */
export type TierDealt = TierChance & Applied;

type At = Omit<Parameters<typeof resolveHit>[1], 'defence'>;

/**
 * One hit of each crit tier on the enemy's layers in order, from what it has left: the number each
 * layer shows, what it loses, and what is left after.
 */
export const dealtOnLayers = (
  built: BuiltAttack,
  at: At,
  defence: Defence,
): readonly TierDealt[] => {
  const byLayer = new Map<Layer, HitResult>(
    LAYERS.map((layer) => [layer, resolveHit(built, { ...at, defence: { ...defence, layer } })]),
  );
  const tierOf = (layer: Layer, index: number) =>
    must(byLayer.get(layer)?.tiers[index], 'Every layer has the same tiers').perType;
  const isWeakPoint = at.part.bodyParts.includes('weakPoint');
  const isShownInOwnTerms = built.assumptions.breakShownInOwnTerms;
  const { tiers } = must(byLayer.get('health'), 'Health is a layer');
  return tiers.map(({ tier, chance }, index) => ({
    tier,
    chance,
    ...applyHit(
      defence.left,
      {
        overguard: tierOf('overguard', index),
        shield: tierOf('shield', index),
        health: tierOf('health', index),
      },
      { isWeakPoint, isShownInOwnTerms },
    ),
  }));
};
