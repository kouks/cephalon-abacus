import fc from 'fast-check';
import { expect, it } from 'vitest';

import { add, mod } from '@/testing/build';
import { elementMod, physicalMod } from '@/testing/composition';
import { BODY, HEAD, hit, makeFaction, makeTarget, shot, WEAK_POINT } from '@/testing/hit';

const bonus = fc.double({ min: -2, max: 4, noNaN: true });
const positive = fc.double({ min: 0, max: 4, noNaN: true });

const target = makeTarget({
  faction: makeFaction({ damageProfile: { slash: 1.5, heat: 0.5 }, factionModGroup: 'grineer' }),
});

const one = (id: string, change: object = {}) => [id, change] as const;

/** Buckets where more is never worse. Elements are not: a bonus can re-pair them. */
const BUCKETS = [
  one('damage.base'),
  one('damage.ips.slash'),
  one('damage.faction.grineer'),
  one('damage.final.eclipse', { op: 'MULTIPLY' }),
  one('crit.chance'),
  one('crit.chanceFlat', { op: 'ADD' }),
  one('crit.chanceWeakPoint'),
  one('crit.damage'),
  one('crit.damageFlat', { op: 'ADD' }),
  one('crit.damageFinal', { op: 'MULTIPLY' }),
  one('weakPoint.damage', { op: 'ADD' }),
  one('headshot.damage'),
  one('multishot'),
];

const modules = (values: readonly number[]) =>
  BUCKETS.map(([bucket, change], index) =>
    mod(`mod-${index}`, [add(bucket, values[index] ?? 0, change)]),
  );

const build = fc.array(bonus, { minLength: BUCKETS.length, maxLength: BUCKETS.length });
const part = fc.constantFrom(BODY, HEAD, WEAK_POINT);

it('a type’s damage is the product of its factors', () => {
  fc.assert(
    fc.property(build, positive, part, (...[values, heat, where]) => {
      const all = [...modules(values), elementMod('heat', 'heat', heat)];
      const { trace, perType } = hit({ modules: all, target }, where);
      for (const [type, damage] of perType) {
        const product = trace.factors
          .filter((factor) => factor.type === undefined || factor.type === type)
          .reduce((result, { value }) => result * value, 1);
        expect(damage).toBeCloseTo(product, 6);
      }
    }),
  );
});

it('damage is never negative', () => {
  fc.assert(
    fc.property(build, part, (values, where) => {
      const { total, tiers, perType } = hit({ modules: modules(values), target }, where);
      const numbers = [total, ...perType.values(), ...tiers.map((entry) => entry.total)];
      for (const number of numbers) expect(number).toBeGreaterThanOrEqual(0);
    }),
  );
});

it('a positive module never lowers a shot’s damage', () => {
  const aim = { head: 0.5, body: 0.5 };
  const chosen = fc.nat({ max: BUCKETS.length - 1 });
  fc.assert(
    fc.property(chosen, positive, positive, (...[index, value, other]) => {
      const [bucket, change] = BUCKETS[index] ?? one('damage.base');
      const before = [
        physicalMod('slash', 'slash', other),
        mod('base', [add('damage.base', other)]),
      ];
      const after = [...before, mod('more', [add(bucket, value, change)])];
      const attack = { flags: ['canCrit', 'canHeadshot'] };
      const damage = (list: readonly { id: string }[]) =>
        shot({ modules: list, target, aim, attack }).total;
      expect(damage(after)).toBeGreaterThanOrEqual(damage(before) * (1 - 1e-9));
    }),
  );
});
