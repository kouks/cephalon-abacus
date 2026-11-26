import { describe, expect, it } from 'vitest';

import type { TierDealt } from '@abacus/engine';

import type { Fired } from './oneHit';
import { oneHitOf } from './oneHit';

const LEFT = { overguard: 0, shield: 0, health: 0 };

const firedWith = (dealt: readonly TierDealt[], attackId = 'normal'): Fired => ({
  attackId: 'normal',
  byAttack: [
    { attackId: 'other', shots: [] },
    { attackId, shots: [{ shot: { hits: [{ dealt }, { dealt: [] }] } }] },
  ],
});

describe('one hit on the enemy as it is', () => {
  it('shows the game’s number first, and what the enemy loses where it differs', () => {
    const breaking: TierDealt = {
      tier: 0,
      chance: 0.75,
      dealt: [
        { layer: 'shield', shown: 586.4, applied: 323.2 },
        { layer: 'health', shown: 14, applied: 14 },
      ],
      left: LEFT,
    };
    expect(oneHitOf(firedWith([breaking]))).toEqual([
      { label: 'White hit', value: 'Shields 586 (323 applied), Health 14' },
    ]);
  });

  it('puts a layer with no number of its own in the one before it', () => {
    const merged: TierDealt = {
      tier: 0,
      chance: 1,
      dealt: [
        { layer: 'overguard', shown: 485, applied: 130.1 },
        { layer: 'health', applied: 354.8 },
      ],
      left: LEFT,
    };
    expect(oneHitOf(firedWith([merged]))[0]?.value).toBe(
      'Overguard 485 (130 applied), Health 355 applied, in the number before',
    );
  });

  it('names every tier by the colour the game draws it in', () => {
    const tiers = [0, 1, 2, 3, 4].map((tier) => ({
      tier,
      chance: 0.2,
      dealt: [{ layer: 'overguard', shown: 10, applied: 10.2 }],
      left: LEFT,
    })) satisfies TierDealt[];
    expect(oneHitOf(firedWith(tiers)).map(({ label }) => label)).toEqual([
      'White hit',
      'Yellow hit',
      'Orange hit',
      'Red hit',
      'Red (tier 4) hit',
    ]);
    expect(oneHitOf(firedWith(tiers))[0]?.value).toBe('Overguard 10');
  });

  it('is nothing for the dummy, or a firing mode the result doesn’t have', () => {
    expect(oneHitOf(firedWith([]))).toEqual([]);
    expect(oneHitOf(firedWith([], 'charged'))).toEqual([]);
  });
});
