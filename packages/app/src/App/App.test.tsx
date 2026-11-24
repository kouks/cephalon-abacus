import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { App } from './App';

it('renders the app name as the page heading', () => {
  expect(renderToStaticMarkup(<App />)).toContain('<h1>Cephalon Abacus</h1>');
});
