import { defineConfig } from 'eslint/config';

import { APP_ENGINE_FILES, APP_FILES, APP_THEME_FILES, GOLDEN_FILES, TS_FILES } from './files.ts';
import { layers } from './rules/layers.ts';
import { APP_SYNTAX, BASE_RESTRICTED_IMPORTS, BASE_SYNTAX, COLOUR_SYNTAX } from './syntax.ts';

const ENGINE_TYPES_ONLY = {
  regex: '^@abacus/engine(?:/|$)',
  allowTypeImports: true,
  message: 'Outside src/engine/ the app imports engine types only (`import type`).',
};

const GOLDEN_API = {
  name: '@abacus/engine',
  allowImportNames: ['evaluate', 'simulate'],
  allowTypeImports: true,
  message: 'Fixtures run through the public API, exactly as the app does.',
};

export const boundaries = defineConfig(
  {
    files: TS_FILES,
    plugins: { architecture: { rules: { layers } } },
    rules: { 'architecture/layers': 'error' },
  },
  {
    files: APP_FILES,
    ignores: APP_ENGINE_FILES,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [...BASE_RESTRICTED_IMPORTS, ENGINE_TYPES_ONLY] },
      ],
      'no-restricted-syntax': ['error', ...BASE_SYNTAX, ...APP_SYNTAX, ...COLOUR_SYNTAX],
    },
  },
  {
    files: APP_THEME_FILES,
    rules: { 'no-restricted-syntax': ['error', ...BASE_SYNTAX, ...APP_SYNTAX] },
  },
  {
    files: GOLDEN_FILES,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [GOLDEN_API], patterns: [...BASE_RESTRICTED_IMPORTS] },
      ],
    },
  },
);
