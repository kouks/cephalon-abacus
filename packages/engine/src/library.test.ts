import { expect, expectTypeOf, it } from 'vitest';

import type { Library } from '@abacus/data/load/loadLibrary';
import { loadLibrary } from '@abacus/data/load/loadLibrary';
import type { Scenario } from '@abacus/data/schema/scenario';
import { libraryFile, weapon } from '@abacus/data/testing/fixtures';

it('reaches the engine through the data package, loader and types', () => {
  const result = loadLibrary([libraryFile('weapons/a.json', weapon)]);
  expect(result.ok && result.library.weapons.has('test-rifle')).toBe(true);
  expectTypeOf(result).extract<{ ok: true }>().toEqualTypeOf<{
    readonly ok: true;
    readonly library: Library;
  }>();
  expectTypeOf<Scenario['build']['weaponId']>().toBeString();
});
