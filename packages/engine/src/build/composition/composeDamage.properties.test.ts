import fc from 'fast-check';
import { expect, it } from 'vitest';

import type { DamageType } from '@abacus/data/schema/damageType';

import { add, mod } from '@/testing/build';
import { compose, elementMod, physicalMod } from '@/testing/composition';

const bonus = fc.double({ min: 0.01, max: 3, noNaN: true });
const amount = fc.double({ min: 1, max: 200, noNaN: true });

const elements = fc.uniqueArray(
  fc.tuple(
    fc.constantFrom<DamageType>('heat', 'cold', 'electricity', 'toxin', 'blast', 'viral'),
    bonus,
  ),
  { maxLength: 4, selector: ([element]) => element },
);

const build = fc.record({
  elements,
  slash: bonus,
  base: bonus,
  damage: fc.record({ impact: amount, slash: amount, heat: amount }),
});

type Build = typeof build extends fc.Arbitrary<infer Value> ? Value : never;

const composeBuild = ({ elements: bonuses, slash, base, damage }: Build) =>
  compose({
    damage,
    modules: [
      ...bonuses.map(([element, value]) => elementMod(`${element}-mod`, element, value)),
      physicalMod('slash-mod', 'slash', slash),
      mod('base-mod', [add('damage.base', base)]),
    ],
  });

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

it('before quantization, damage adds up to the total of BIBLE §6', () => {
  fc.assert(
    fc.property(build, (parts) => {
      const total = sum(Object.values(parts.damage));
      const elemental = sum(parts.elements.map(([, value]) => value));
      const physical = (parts.damage.slash / total) * parts.slash;
      const { types, moddedBase } = composeBuild(parts);
      const raw = sum([...types.values()].map(({ ratio }) => ratio * moddedBase.value));
      expect(raw / (total * (1 + elemental + physical) * (1 + parts.base))).toBeCloseTo(1, 9);
    }),
  );
});

it('every type is a whole number of 32nds of the modded base', () => {
  fc.assert(
    fc.property(build, (parts) => {
      const { types, moddedBase } = composeBuild(parts);
      for (const { damage } of types.values()) {
        const steps = (damage / moddedBase.value) * 32;
        expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
      }
    }),
  );
});
