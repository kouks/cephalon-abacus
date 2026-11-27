import { describe, expect, it } from 'vitest';

import { loadRealLibrary } from './loadRealLibrary.ts';

const library = loadRealLibrary();

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
});
