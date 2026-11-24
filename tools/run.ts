/**
 * `node tools/run.ts <script> [args]`: runs a script that imports workspace packages. Vite resolves
 * `@/…` and extensionless paths here exactly as it does in the app and in the tests.
 */
import path from 'node:path';

import { runnerImport } from 'vite';

const [script] = process.argv.slice(2);

if (script === undefined) throw new Error('Pass the script to run.');

await runnerImport(path.resolve(script), {
  configFile: false,
  logLevel: 'error',
  resolve: { tsconfigPaths: true },
});
