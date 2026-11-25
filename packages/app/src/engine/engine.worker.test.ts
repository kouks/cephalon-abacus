import '@vitest/web-worker';

import { describe, expect, it } from 'vitest';

import { must } from '@abacus/data/assert';
import { scenario } from '@abacus/data/testing/fixtures';

import { createEngine } from './createEngine';

const engine = createEngine();

const braton = {
  ...scenario,
  build: { ...scenario.build, weaponId: 'braton', modules: [{ moduleId: 'serration' }] },
  enemy: { ...scenario.enemy, id: 'neutral-dummy' },
  aim: { head: 0, body: 1 },
};

const evaluated = async (input: unknown) => {
  const reply = must(await engine.evaluate(input), 'Nothing newer came along');
  if (reply.status !== 'evaluated') throw new Error(JSON.stringify(reply));
  return reply.result;
};

describe('the engine in a Web Worker', () => {
  it('lists the real library’s weapons and the mods that fit them', async () => {
    const { weapons } = await engine.catalog();
    expect(weapons).toHaveLength(13);
    const modsOf = (id: string) =>
      weapons.find((weapon) => weapon.id === id)?.modules.map((module) => module.id) ?? [];
    expect(modsOf('braton')).toContain('serration');
    expect(modsOf('braton')).not.toContain('hornet-strike');
    expect(modsOf('lex')).toContain('hornet-strike');
    expect(modsOf('amprex')).toContain('sinister-reach');
    expect(modsOf('braton')).not.toContain('sinister-reach');
  });

  it('sends a result back whole, maps and infinities included', async () => {
    const { perShot, trace, byAttack } = await evaluated(braton);
    expect(perShot).toBeCloseTo(24.75 * 2.65 * (1 + 0.12 * ((205 * 32) / 4095 - 1)), 9);
    expect(trace[0]?.perType).toBeInstanceOf(Map);
    expect(byAttack[0]?.rates.shotsPerMagazine).toBe(45);
    const penta = { ...braton, build: { ...braton.build, weaponId: 'penta' } };
    expect((await evaluated(penta)).byAttack[0]?.shots).toHaveLength(2);
  });

  it('says what is wrong with a scenario', async () => {
    expect(await engine.evaluate({ ...braton, mode: 'average' })).toEqual({
      status: 'invalid',
      problems: [expect.stringMatching(/^mode: /)],
    });
    expect(await engine.evaluate('braton')).toMatchObject({ status: 'invalid' });
  });

  it('says what went wrong', async () => {
    const build = { ...braton.build, weaponId: 'nothing' };
    const message = 'No weapon "nothing"';
    expect(await engine.evaluate({ ...braton, build })).toEqual({ status: 'failed', message });
  });

  it('answers the newest of several scenarios at once', async () => {
    const replies = await Promise.all([braton, braton, braton].map(engine.evaluate));
    expect(replies.map((reply) => reply?.status)).toEqual([undefined, undefined, 'evaluated']);
  });
});
