import path from 'node:path';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const ROOT = path.resolve(import.meta.dirname, '../..');

const real = new ESLint({ cwd: ROOT });

/** Type-aware rules need a file on disk, so virtual paths are linted without them. */
const untyped = new ESLint({
  cwd: ROOT,
  overrideConfig: [
    tseslint.configs.disableTypeChecked,
    { languageOptions: { parserOptions: { projectService: false } } },
  ],
});

const lint = async (eslint: ESLint, filePath: string, code: string) => {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, filePath) });
  return (result?.messages ?? []).map(({ ruleId, message }) => ruleId ?? `fatal: ${message}`);
};

/** The rules that fire on `code` at a path that need not exist. */
export const lintVirtual = (filePath: string, code: string) => lint(untyped, filePath, code);

/** As `lintVirtual`, with type-aware rules. The path must exist; its content is replaced. */
export const lintTyped = (filePath: string, code: string) => lint(real, filePath, code);

export type Banned = readonly [name: string, file: string, code: string, rule: string];

/** Code that imports a value and uses it. */
export const valueFrom = (from: string, name = 'a') =>
  `import { ${name} } from '${from}'; export const used = ${name};`;

/** Code that imports a type and uses it. */
export const typeFrom = (from: string) => `import type { A } from '${from}'; export type Used = A;`;
