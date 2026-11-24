import { defineConfig } from 'eslint/config';

import { STORY_FILES, TEST_FILES, TS_FILES } from './files.ts';

export const limits = defineConfig(
  {
    files: TS_FILES,
    rules: {
      complexity: ['error', 8],
      'max-depth': ['error', 3],
      'max-lines': ['error', 150],
      'max-lines-per-function': ['error', 40],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 3],
    },
  },
  {
    files: TEST_FILES,
    rules: { 'max-lines': ['error', 300], 'max-lines-per-function': 'off' },
  },
  {
    files: STORY_FILES,
    rules: { 'max-lines': ['error', 200] },
  },
);
