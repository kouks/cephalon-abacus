import '@vitest/web-worker';

import { describe, expect, it } from 'vitest';

import { scenario } from '@abacus/data/testing/fixtures';

import { createEngine } from '@/engine/createEngine';

import { traceRows } from './traceRows';

const engine = createEngine();

type Request = [weaponId: string, modules: readonly string[], aim: object, change?: object];

const rowsFor = async (...[weaponId, modules, aim, change = {}]: Request) => {
  const build = {
    ...scenario.build,
    weaponId,
    modules: modules.map((moduleId) => ({ moduleId })),
    ...change,
  };
  const enemy = { ...scenario.enemy, id: 'neutral-dummy' };
  const reply = await engine.evaluate({ ...scenario, build, enemy, aim });
  if (reply?.status !== 'evaluated') throw new Error(JSON.stringify(reply));
  return traceRows(reply.result);
};

const lines = (rows: Awaited<ReturnType<typeof rowsFor>>) =>
  rows.map(({ hit, factor, type, value, effects }) =>
    [hit, factor, type, value, effects].join(' | '),
  );

describe('trace rows', () => {
  it('have every factor of a hit, with the bonuses behind it', async () => {
    const rows = await rowsFor('braton', ['serration', 'point-strike', 'hellfire'], {
      head: 0,
      body: 1,
    });
    expect(new Set(rows.map(({ key }) => key)).size).toBe(rows.length);
    expect(lines(rows)).toEqual([
      'normal 1, 100% of hits | base | all | 64 | Serration +165%',
      'normal 1, 100% of hits | share | impact | 0.3438x | ',
      'normal 1, 100% of hits | share | puncture | 0.3438x | ',
      'normal 1, 100% of hits | share | slash | 0.3438x | ',
      'normal 1, 100% of hits | share | heat | 0.9063x | Hellfire +90%',
      'normal 1, 100% of hits | faction | all | 1x | ',
      'normal 1, 100% of hits | crit | all | 1.1806x | Point Strike +150%',
      'normal 1, 100% of hits | bodyPart | all | 1x | ',
      'normal 1, 100% of hits | range | all | 1x | ',
      'normal 1, 100% of hits | falloff | all | 1x | ',
      'normal 1, 100% of hits | vulnerability | impact | 1x | ',
      'normal 1, 100% of hits | vulnerability | puncture | 1x | ',
      'normal 1, 100% of hits | vulnerability | slash | 1x | ',
      'normal 1, 100% of hits | vulnerability | heat | 1x | ',
      'normal 1, 100% of hits | layer | all | 1x | ',
      'normal 1, 100% of hits | armor | all | 1x | ',
      'normal 1, 100% of hits | reduction | all | 1x | ',
    ]);
  });

  it('tell hits apart, those of explosions too', async () => {
    const rows = await rowsFor('penta', [], { head: 0.25, body: 0.75 });
    expect([...new Set(rows.map(({ hit }) => hit))]).toEqual([
      'grenade-impact 1, 25% of hits',
      'grenade-impact 2, 75% of hits',
      'grenade-detonation 1, 100% of hits',
    ]);
  });

  it('show flat bonuses as they are', async () => {
    const rows = await rowsFor('vectis-prime', ['primary-acuity'], { head: 1, body: 0 });
    const part = rows.find(({ factor }) => factor === 'bodyPart');
    expect(part).toMatchObject({ value: '8.247x', effects: 'Primary Acuity +3.498' });
  });

  it('are of the headline’s firing mode', async () => {
    const rows = await rowsFor('paris', [], { head: 0, body: 1 }, { attackId: 'charged' });
    expect(new Set(rows.map(({ hit }) => hit))).toEqual(new Set(['charged 1, 100% of hits']));
  });

  it('show the stacks of a conditional', () => {
    const source = { id: 'galvanized-chamber', name: 'Galvanized Chamber' };
    const conditional = { trigger: 'onKill', stacks: 2, maxStacks: 5 } as const;
    const effects = [
      { source, bucket: 'multishot', op: 'STACKING_MULTIPLY', value: 0.6, conditional } as const,
    ];
    const factors = [{ name: 'faction', value: 1.6, effects } as const];
    const shots = [
      { attackId: 'normal', shot: { hits: [{ share: 1, hit: { trace: { factors } } }] } },
    ];
    const [row] = traceRows({ attackId: 'normal', byAttack: [{ attackId: 'normal', shots }] });
    expect(row?.effects).toBe('Galvanized Chamber +60% (2 of 5 stacks)');
  });
});
