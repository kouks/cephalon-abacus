import { expect, it } from 'vitest';

import { must } from '@abacus/data/assert';
import { enemy, module, weapon } from '@abacus/data/testing/fixtures';
import { goldenFixtureSchema } from '@abacus/data/schema/goldenFixture';

import { libraryWith, loadFixtures } from './loadFixtures';

it('a fixture brings what the library lacks', () => {
  const [first] = loadFixtures();
  const { fixture } = must(first, 'No fixtures');
  const bringing = { modules: [module], weapons: [weapon], enemies: [enemy] };
  const { modules, weapons, enemies } = libraryWith(
    goldenFixtureSchema.parse({ ...fixture, ...bringing }),
  );
  expect(modules.has('test-mod') && modules.has('serration')).toBe(true);
  expect(weapons.has('test-rifle') && weapons.has('braton')).toBe(true);
  expect(enemies.has('test-enemy') && enemies.has('runner')).toBe(true);
});
