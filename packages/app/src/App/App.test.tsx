import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import type { Engine } from '@/engine/connectEngine';

import { App } from './App';

const engine: Engine = {
  catalog: () => Promise.resolve({ weapons: [], targets: [] }),
  evaluate: () => Promise.resolve(undefined),
};

it('renders the app name as the page heading, and the debug page under it', () => {
  const page = renderToStaticMarkup(<App engine={engine} />);
  expect(page).toContain('<h1>Cephalon Abacus</h1>');
  for (const text of ['Weapon', 'Mods', 'Target', 'Scenario, as JSON', 'Waiting for the engine']) {
    expect(page).toContain(text);
  }
  expect(page).toContain('braton');
});
