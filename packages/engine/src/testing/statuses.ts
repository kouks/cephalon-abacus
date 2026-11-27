/** The statuses the damage types proc, with the wiki's stacks and durations, and Microwave. */
import type { DamageType } from '@abacus/data/schema/damageType';

/** The status each type procs, as damageTypes.json has it. */
export const PROCS: Readonly<Partial<Record<DamageType, string>>> = {
  impact: 'knockback',
  puncture: 'weakened',
  slash: 'bleed',
  heat: 'ignite',
  cold: 'freeze',
  electricity: 'tesla-chain',
  toxin: 'poison',
  blast: 'detonate',
  corrosive: 'corrosion',
  gas: 'gas-cloud',
  magnetic: 'disrupt',
  radiation: 'confusion',
  viral: 'virus',
  void: 'bullet-attractor',
  tau: 'status-vulnerability',
};

type Made = { readonly duration?: number; readonly stacking: object } & Readonly<
  Record<string, unknown>
>;

const status = (id: string, { duration, ...rest }: Made) => ({
  id,
  name: id,
  source: 'https://wiki.warframe.com/w/Status_Effect',
  gameVersion: '44.1.4.1',
  ...(duration === undefined ? {} : { duration }),
  confidence: 'W',
  ...rest,
});

/** An effect worth `first` at one stack and `more` for each after it. */
const effect = (bucket: string, op: string, [first, more]: readonly [number, number]) => ({
  bucket,
  op,
  first,
  more,
});

const capped = (most: number) => ({ kind: 'capped', most });
const INDEPENDENT = { kind: 'independent' };

export const STATUS_ITEMS = [
  status('knockback', { duration: 6, stacking: capped(5) }),
  status('weakened', {
    duration: 10,
    stacking: capped(5),
    effects: [{ ...effect('crit.chanceFlat', 'ADD', [0.05, 0.05]), scope: ['direct'] }],
  }),
  status('bleed', { duration: 6, stacking: INDEPENDENT }),
  status('ignite', { duration: 6, stacking: { kind: 'merged' } }),
  status('freeze', {
    duration: 6,
    stacking: capped(10),
    overguardMost: 4,
    effects: [{ ...effect('crit.damageFlat', 'ADD', [0.1, 0.05]), atMost: 1, scope: ['direct'] }],
  }),
  status('tesla-chain', { duration: 6, stacking: INDEPENDENT }),
  status('poison', { duration: 6, stacking: INDEPENDENT }),
  status('detonate', { duration: 1.5, stacking: capped(10) }),
  status('corrosion', {
    duration: 8,
    stacking: capped(10),
    effects: [effect('enemy.armor', 'MULTIPLY', [-0.26, -0.06])],
  }),
  status('gas-cloud', { duration: 6, stacking: capped(10) }),
  status('disrupt', {
    duration: 6,
    stacking: capped(10),
    effects: [effect('enemy.shield', 'STACKING_MULTIPLY', [1, 0.25])],
  }),
  status('confusion', { duration: 12, stacking: capped(10) }),
  status('virus', {
    duration: 6,
    stacking: capped(10),
    effects: [effect('enemy.health', 'STACKING_MULTIPLY', [1, 0.25])],
  }),
  status('bullet-attractor', { duration: 3, stacking: INDEPENDENT }),
  status('status-vulnerability', {
    duration: 8,
    stacking: capped(10),
    effects: [effect('enemy.status', 'STACKING_MULTIPLY', [0.1, 0.1])],
  }),
  status('microwave', { stacking: INDEPENDENT }),
];
