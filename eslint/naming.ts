import checkFile from 'eslint-plugin-check-file';
import { defineConfig } from 'eslint/config';

import { TS_FILES } from './files.ts';

const COMPONENT_FOLDER = '**/[A-Z]*/';

export const naming = defineConfig({
  files: TS_FILES,
  plugins: { 'check-file': checkFile },
  rules: {
    'check-file/no-index': 'error',
    'check-file/filename-naming-convention': [
      'error',
      {
        '**/*.tsx': 'PASCAL_CASE',
        '**/*.{hooks,css}.ts': 'PASCAL_CASE',
        '**/!(*.hooks|*.css).ts': 'CAMEL_CASE',
      },
      { ignoreMiddleExtensions: true },
    ],
    'check-file/folder-match-with-fex': [
      'error',
      {
        '*.hooks.{ts,tsx}': COMPONENT_FOLDER,
        '*.stories.tsx': COMPONENT_FOLDER,
      },
    ],
  },
});
