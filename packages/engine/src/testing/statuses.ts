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

const capped = (most: number) => ({ kind: 'capped', most });
const INDEPENDENT = { kind: 'independent' };

export const STATUS_ITEMS = [
  status('knockback', { duration: 6, stacking: capped(5) }),
  status('weakened', { duration: 10, stacking: capped(5) }),
  status('bleed', { duration: 6, stacking: INDEPENDENT }),
  status('ignite', { duration: 6, stacking: { kind: 'merged' } }),
  status('freeze', { duration: 6, stacking: capped(10), overguardMost: 4 }),
  status('tesla-chain', { duration: 6, stacking: INDEPENDENT }),
  status('poison', { duration: 6, stacking: INDEPENDENT }),
  status('detonate', { duration: 1.5, stacking: capped(10) }),
  status('corrosion', { duration: 8, stacking: capped(10) }),
  status('gas-cloud', { duration: 6, stacking: capped(10) }),
  status('disrupt', { duration: 6, stacking: capped(10) }),
  status('confusion', { duration: 12, stacking: capped(10) }),
  status('virus', { duration: 6, stacking: capped(10) }),
  status('bullet-attractor', { duration: 3, stacking: INDEPENDENT }),
  status('status-vulnerability', {
    duration: 8,
    stacking: capped(10),
    effect: { on: 'statusChanceTaken', first: 0.1, more: 0.1 },
  }),
  status('microwave', { stacking: INDEPENDENT }),
];
