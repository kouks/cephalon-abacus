import type { Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

import { DATA_FILES, ENGINE_FILES, TEST_FILES } from './files.ts';
import { BASE_RESTRICTED_IMPORTS } from './syntax.ts';

const LANGUAGE = new Set(Object.keys(globals.builtin));
const HOST = Object.keys({ ...globals.browser, ...globals.worker, ...globals.node });

/** Everything the host adds to the language, plus the parts of the language that are not pure. */
const IMPURE_GLOBALS = [
  ...new Set([...HOST.filter((name) => !LANGUAGE.has(name)), 'Date', 'globalThis']),
].map((name) => ({
  name,
  message: 'The engine and the data library are pure: no DOM, Node APIs, clock or host globals.',
}));

/** Only relative paths, `@/…`, other workspace packages and the named libraries. */
const onlyImports = (...libraries: readonly string[]) => ({
  regex: `^(?!(?:@/|\\.{1,2}(?:/|$)|@abacus/|(?:${['$^', ...libraries].join('|')})(?:/|$)))`,
  message: 'Framework-free: no React, DOM libraries or Node modules here.',
});

const importsRule = (...libraries: readonly string[]): Linter.RulesRecord => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    { patterns: [...BASE_RESTRICTED_IMPORTS, onlyImports(...libraries)] },
  ],
});

const TEST_LIBRARIES = ['vitest', 'fast-check'];

export const purity = defineConfig(
  {
    files: [...ENGINE_FILES, ...DATA_FILES],
    rules: {
      'no-restricted-globals': ['error', ...IMPURE_GLOBALS],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Randomness comes only from a Roller.' },
      ],
    },
  },
  { files: ENGINE_FILES, rules: importsRule() },
  { files: DATA_FILES, rules: importsRule('zod') },
  {
    files: TEST_FILES.map((glob) => `packages/engine/src/${glob}`),
    rules: importsRule(...TEST_LIBRARIES),
  },
  {
    files: TEST_FILES.map((glob) => `packages/data/src/${glob}`),
    rules: importsRule('zod', ...TEST_LIBRARIES),
  },
);
