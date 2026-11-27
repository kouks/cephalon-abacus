import { describe, expect, it } from 'vitest';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();

/** Every status's effects, by its id. */
const effects = [...library.statuses.values()].flatMap(({ id, effects = [] }) =>
  effects.map((effect) => ({ id, ...effect })),
);

describe('statuses.json', () => {
  it('has every status a damage type procs, and Microwave, which no type procs', () => {
    const procs = [...library.damageTypes.values()].flatMap(({ proc }) =>
      proc === undefined ? [] : [proc],
    );
    const others = [...library.statuses.keys()].filter((id) => !procs.includes(id));
    expect(procs.every((proc) => library.statuses.has(proc))).toBe(true);
    expect(others).toEqual(['microwave']);
  });

  /** Checked against the wiki's status pages for Update 44 (BIBLE §8). */
  it('has the wiki’s stacks and durations', () => {
    const table = [...library.statuses.values()].map(({ id, duration, stacking, confidence }) =>
      [
        id,
        duration === undefined ? 'until it dies' : `${duration} s`,
        stacking.kind === 'capped' ? `most ${stacking.most}` : stacking.kind,
        confidence,
      ].join(' | '),
    );
    expect(table).toMatchInlineSnapshot(`
      [
        "knockback | 6 s | most 5 | W",
        "weakened | 10 s | most 5 | W",
        "bleed | 6 s | independent | W",
        "ignite | 6 s | merged | W",
        "freeze | 6 s | most 10 | W",
        "tesla-chain | 6 s | independent | W",
        "poison | 6 s | independent | W",
        "detonate | 1.5 s | most 10 | W",
        "corrosion | 8 s | most 10 | W",
        "gas-cloud | 6 s | most 10 | W",
        "disrupt | 6 s | most 10 | W",
        "confusion | 12 s | most 10 | W",
        "virus | 6 s | most 10 | W",
        "bullet-attractor | 3 s | independent | C",
        "status-vulnerability | 8 s | most 10 | W",
        "microwave | until it dies | independent | C",
      ]
    `);
  });

  /** What each does to the hits that meet the enemy, by its stacks: the wiki's status pages (BIBLE §8). */
  it('has the wiki’s effects on hits', () => {
    const table = effects.map(({ id, bucket, op, first, more, atMost, scope }) =>
      [
        id,
        `${bucket} ${op}`,
        `${first} then ${more} a stack`,
        atMost === undefined ? 'no most' : `${atMost} at the most`,
        scope === undefined ? 'every hit' : scope.join(', '),
      ].join(' | '),
    );
    expect(table).toMatchInlineSnapshot(`
      [
        "weakened | crit.chanceFlat ADD | 0.05 then 0.05 a stack | no most | direct",
        "freeze | crit.damageFlat ADD | 0.1 then 0.05 a stack | 1 at the most | direct",
        "corrosion | enemy.armor MULTIPLY | -0.26 then -0.06 a stack | no most | every hit",
        "disrupt | enemy.shield STACKING_MULTIPLY | 1 then 0.25 a stack | no most | every hit",
        "virus | enemy.health STACKING_MULTIPLY | 1 then 0.25 a stack | no most | every hit",
        "status-vulnerability | enemy.status STACKING_MULTIPLY | 0.1 then 0.1 a stack | no most | every hit",
      ]
    `);
  });
});
