import { describe, expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { factorOf, hit, makeFaction, makeTarget } from '@/testing/hit';

const bane = (group: string, value = 0.3) =>
  mod(`bane-${group}`, [add(`damage.faction.${group}`, value)]);
const ROAR = mod('roar', [add('damage.faction.all', 0.5)]);

const GRINEER = makeTarget({ faction: makeFaction({ factionModGroup: 'grineer' }) });
const UNGROUPED = makeTarget({ faction: makeFaction({}) });

const final = (id: string, value: number, change: object = {}) =>
  mod(id, [add(`damage.final.${id}`, value, { op: 'MULTIPLY', ...change })]);

const faction = (target: ReturnType<typeof makeTarget>, ...modules: readonly { id: string }[]) =>
  factorOf(hit({ modules, target }), 'faction').value;

describe('the faction factor', () => {
  it('adds up Bane of Grineer and Roar against Grineer', () => {
    expect(faction(GRINEER, bane('grineer'))).toBeCloseTo(1.3, 12);
    expect(faction(GRINEER, bane('grineer'), ROAR)).toBeCloseTo(1.8, 12);
  });

  it('leaves out bonuses against others', () => {
    expect(faction(GRINEER, bane('corpus'))).toBe(1);
    expect(faction(UNGROUPED, bane('grineer'), ROAR)).toBeCloseTo(1.5, 12);
    expect(faction(makeTarget(), bane('grineer'), ROAR)).toBeCloseTo(1.5, 12);
  });

  it('names its bonuses', () => {
    const modules = [bane('grineer'), bane('corpus'), ROAR];
    const { effects } = factorOf(hit({ modules, target: GRINEER }), 'faction');
    expect(effects.map(({ source }) => source.name).sort()).toEqual(['bane-grineer', 'roar']);
  });
});

describe('final multipliers', () => {
  it('each multiply on their own', () => {
    const result = hit({ modules: [final('eclipse', 1), final('volt', 0.5)] });
    expect(factorOf(result, 'final.eclipse').value).toBe(2);
    expect(factorOf(result, 'final.volt').value).toBe(1.5);
    expect(result.total / hit().total).toBeCloseTo(3, 12);
    const { effects } = factorOf(result, 'final.volt');
    expect(effects.map(({ source }) => source.name)).toEqual(['volt']);
  });

  it('are not there without a bonus', () => {
    const names = hit().trace.factors.map(({ name }) => name);
    expect(names.filter((name) => name.startsWith('final.'))).toEqual([]);
  });

  it('never turn damage negative', () => {
    expect(hit({ modules: [final('curse', -1.5)] }).total).toBe(0);
  });
});
