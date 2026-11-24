import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

import { base } from './eslint/base.ts';
import { boundaries } from './eslint/boundaries.ts';
import { limits } from './eslint/limits.ts';
import { naming } from './eslint/naming.ts';
import { purity } from './eslint/purity.ts';

export default defineConfig(
  globalIgnores(['**/dist/', '**/coverage/', '**/node_modules/']),
  base,
  limits,
  naming,
  boundaries,
  purity,
  prettier,
);
