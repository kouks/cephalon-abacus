import path from 'node:path';

import js from '@eslint/js';
import type { Linter } from 'eslint';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import { CONFIG_FILES, STORY_FILES, TS_FILES } from './files.ts';
import { BASE_RESTRICTED_IMPORTS, BASE_SYNTAX } from './syntax.ts';

/** Absolute, so lint behaves the same from any working directory. */
const ROOT = path.resolve(import.meta.dirname, '..');

const TSCONFIGS = [
  'packages/data/tsconfig.json',
  'packages/engine/tsconfig.json',
  'packages/importers/tsconfig.json',
  'packages/app/tsconfig.app.json',
  'tools/tsconfig.json',
];

const typescriptRules: Linter.RulesRecord = {
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
  ],
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...BASE_RESTRICTED_IMPORTS] }],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
};

const generalRules: Linter.RulesRecord = {
  eqeqeq: 'error',
  'func-style': ['error', 'expression'],
  'import-x/no-cycle': 'error',
  'import-x/no-default-export': 'error',
  'no-irregular-whitespace': [
    'error',
    {
      skipComments: false,
      skipJSXText: false,
      skipRegExps: false,
      skipStrings: false,
      skipTemplates: false,
    },
  ],
  'no-restricted-syntax': ['error', ...BASE_SYNTAX],
  'prefer-arrow-callback': 'error',
  'react-hooks/exhaustive-deps': 'error',
  'react-hooks/rules-of-hooks': 'error',
};

export const base = defineConfig(
  {
    files: TS_FILES,
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    plugins: { 'import-x': importX, 'react-hooks': { rules: reactHooks.rules } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: ROOT } },
    settings: {
      'import-x/extensions': ['.ts', '.tsx'],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          noWarnOnMultipleProjects: true,
          project: TSCONFIGS.map((file) => path.join(ROOT, file)),
        }),
      ],
    },
    rules: { ...generalRules, ...typescriptRules },
  },
  {
    files: [...CONFIG_FILES, ...STORY_FILES],
    rules: { 'import-x/no-default-export': 'off' },
  },
);
