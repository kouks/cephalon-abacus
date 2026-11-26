import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';

import { buildAttack } from '@/build/buildAttack';
import type { LayersLeft } from '@/resolve/applyHit';
import { drawingRoller, EXPECTED_ROLLER } from '@/resolve/roller';
import type { AimedPart } from '@/resolve/target';
import { add, makeLibrary, mod } from '@/testing/build';
import { BODY, HEAD, loadoutOf, makeTarget } from '@/testing/hit';

import { stateOf } from './enemyState';
import type { Fight, Strike } from './pellet';
import { stacksAt } from './statuses';
import { pullTrigger } from './trigger';

const library = makeLibrary([]);
const ON_BODY: readonly AimedPart[] = [{ part: BODY, share: 1 }];
const TAU = { damage: { tau: 100 }, statusChance: 1, critChance: 0 };
const VULNERABILITY = 'status-vulnerability';

type Pull = {
  readonly left?: Partial<LayersLeft>;
  readonly fight?: Partial<Fight>;
  readonly parts?: readonly AimedPart[];
  readonly modules?: readonly { readonly id: string }[];
  readonly at?: number;
};

const strikeOf = (attack: object, { parts = ON_BODY, modules = [] }: Pull = {}): Strike => {
  const loadout = loadoutOf({ attack, modules });
  const built = buildAttack(loadout, must(loadout.weapon.attacks[0], 'An attack'));
  return { built, parts, distance: 10 };
};

const fightWith = ({ left = {}, fight = {} }: Pull): Fight => ({
  target: makeTarget(),
  defence: {
    layer: 'health',
    armor: 0,
    rules: library.damageTypes,
    left: { overguard: 0, shield: 0, health: 1000, ...left },
  },
  library,
  enemy: {},
  roller: EXPECTED_ROLLER,
  ...fight,
});

const pull = (attacks: readonly object[], setup: Pull = {}) => {
  const fight = fightWith(setup);
  const strikes = attacks.map((attack) => strikeOf(attack, setup));
  return pullTrigger(stateOf(fight.defence.left, setup.at), strikes, fight);
};

const layersOf = (dealt: readonly { readonly layer: string }[]) => dealt.map(({ layer }) => layer);

describe('the pellets of one trigger pull', () => {
  it('wear the layers down one at a time, and meet the next layer once one is gone', () => {
    const attack = { damage: { impact: 100 }, critChance: 0, statusChance: 0, multishot: 3 };
    const { state, hits } = pull([attack], { left: { shield: 150 } });
    const layers = hits.map(({ dealt }) => layersOf(dealt[0]?.dealt ?? []));
    expect(layers).toEqual([['shield'], ['shield', 'health'], ['health']]);
    expect(hits.map(({ hit }) => hit.trace.layer)).toEqual(['shield', 'shield', 'health']);
    expect(state.left).toEqual({ overguard: 0, shield: 0, health: 1000 - 2.5 - 100 });
  });

  it('see what earlier pellets left on the enemy: Tau makes the next chance 10% more', () => {
    const { state, hits } = pull([{ ...TAU, multishot: 2 }]);
    expect(hits.map(({ hit }) => hit.trace.procs[0]?.count)).toEqual([1, expect.closeTo(1.1, 12)]);
    expect(stacksAt(state.statuses, VULNERABILITY, 0)).toBeCloseTo(2.1, 12);
  });

  it('are a direct hit and then its explosion, which sees the direct hit’s statuses', () => {
    const { state } = pull([TAU, TAU]);
    expect(stacksAt(state.statuses, VULNERABILITY, 0)).toBeCloseTo(2.1, 12);
  });

  it('end in a share of a pellet, in expected value', () => {
    const { state, hits } = pull([{ ...TAU, multishot: 1.5 }]);
    expect(hits.map(({ pellet, amount }) => [pellet, amount])).toEqual([
      [0, 1],
      [1, 0.5],
    ]);
    expect(state.left.health).toBeCloseTo(1000 - 150, 9);
    expect(stacksAt(state.statuses, VULNERABILITY, 0)).toBeCloseTo(1 + 0.5 * 1.1, 12);
  });

  it('are whole when drawn, and so are their stacks', () => {
    const fight = { roller: drawingRoller(() => 0.25) };
    const { state, hits } = pull([{ ...TAU, multishot: 1.5 }], { fight });
    expect(hits.map(({ amount }) => amount)).toEqual([1, 1]);
    expect(state.left.health).toBe(800);
    expect(stacksAt(state.statuses, VULNERABILITY, 0)).toBe(2);
  });

  it('mix the parts aimed at, in expected value', () => {
    const parts = [
      { part: HEAD, share: 0.5 },
      { part: BODY, share: 0.5 },
    ];
    const attack = { damage: { impact: 100 }, critChance: 0, statusChance: 0 };
    const { state, hits } = pull([attack], { parts });
    expect(hits.map(({ amount }) => amount)).toEqual([0.5, 0.5]);
    expect(state.left.health).toBeCloseTo(1000 - (0.5 * 300 + 0.5 * 100), 9);
  });

  it('carry the time and their number in their traces', () => {
    const { hits } = pull([{ ...TAU, multishot: 2 }], { at: 5 });
    expect(hits.map(({ hit }) => [hit.trace.t, hit.trace.pellet])).toEqual([
      [5, 0],
      [5, 1],
    ]);
  });
});

describe('the statuses they leave', () => {
  const COLD = { damage: { cold: 100 }, statusChance: 6, critChance: 0 };

  it('take at most 4 Cold stacks while the enemy has Overguard (the wiki’s Cold page)', () => {
    const guarded = pull([COLD], { left: { overguard: 100_000 } });
    expect(stacksAt(guarded.state.statuses, 'freeze', 0)).toBe(4);
    expect(stacksAt(pull([COLD]).state.statuses, 'freeze', 0)).toBe(6);
  });

  it('last as long as status duration makes them', () => {
    const lasting = mod('lasting', [add('status.duration', 1)]);
    const { state } = pull([TAU], { modules: [lasting] });
    expect(stacksAt(state.statuses, VULNERABILITY, 15.9)).toBe(1);
    expect(stacksAt(pull([TAU]).state.statuses, VULNERABILITY, 8)).toBe(0);
  });

  it('can last until the enemy dies: Microwave', () => {
    const attack = { ...TAU, statusChance: 0, forcedProcs: [{ status: 'microwave', count: 1 }] };
    expect(stacksAt(pull([attack]).state.statuses, 'microwave', 1e9)).toBe(1);
  });
});
