import { defineConfig } from 'vitest/config';

/** One project per package, plus tools and the golden fixtures. `@/…` resolves per package. */
const project = (name: string, root: string, include: string) => ({
  resolve: { tsconfigPaths: true },
  test: { name, root, include: [include] },
});

/**
 * The first lint in each ESLint config test loads the whole config and its plugins, which can take
 * more than Vitest's 5 s on CI (ABA-63).
 */
const tools = project('tools', 'tools', '**/*.test.ts');
const LINTING = { ...tools, test: { ...tools.test, testTimeout: 30_000 } };

export default defineConfig({
  test: {
    projects: [
      project('data', 'packages/data', 'src/**/*.test.ts'),
      project('engine', 'packages/engine', 'src/**/*.test.ts'),
      project('importers', 'packages/importers', 'src/**/*.test.ts'),
      project('app', 'packages/app', 'src/**/*.test.{ts,tsx}'),
      LINTING,
      project('golden', 'tests/golden', '**/*.test.ts'),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Matched against each project's root, not the repository's.
      include: ['**/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.stories.tsx'],
      thresholds: {
        'packages/engine/src/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
      },
    },
  },
});
