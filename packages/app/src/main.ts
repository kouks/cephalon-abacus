import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { must } from '@abacus/data/assert';

import { App } from '@/App/App';
import { createEngine } from '@/engine/createEngine';

const root = must(document.getElementById('root'), 'index.html has no #root element');

const app = createElement(App, { engine: createEngine() });

createRoot(root).render(createElement(StrictMode, null, app));
