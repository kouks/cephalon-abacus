import { expect, it } from 'vitest';

import { loadLibrary } from '@abacus/data/load/loadLibrary';
import { libraryFile, module, referenceFiles, weapon } from '@abacus/data/testing/fixtures';

import { catalogOf } from './catalog';

const fitting = (id: string, compat: object) => ({ ...module, id, name: `The ${id}`, compat });

it('lists the modules that fit each weapon, by slot and class', () => {
  const loaded = loadLibrary([
    ...referenceFiles,
    libraryFile('weapons/a.json', { ...weapon, class: ['rifle', 'beam'] }),
    libraryFile(
      'mods/a.json',
      fitting('rifles', { slots: ['primary'], classes: ['rifle'] }),
      fitting('beams', { slots: ['secondary', 'primary'], classes: ['shotgun', 'beam'] }),
      fitting('primaries', { slots: ['primary'] }),
      fitting('shotguns', { slots: ['primary'], classes: ['shotgun'] }),
      fitting('secondaries', { slots: ['secondary'], classes: ['rifle'] }),
    ),
  ]);
  if (!loaded.ok) throw new Error('The fixtures are valid');
  expect(catalogOf(loaded.library)).toEqual({
    weapons: [
      {
        id: 'test-rifle',
        name: 'test-rifle',
        modules: [
          { id: 'rifles', name: 'The rifles' },
          { id: 'beams', name: 'The beams' },
          { id: 'primaries', name: 'The primaries' },
        ],
      },
    ],
  });
});
