import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { must } from '@abacus/data/assert';

import { App } from '@/App/App';

const root = must(document.getElementById('root'), 'index.html has no #root element');

createRoot(root).render(createElement(StrictMode, null, createElement(App)));
