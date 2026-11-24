import path from 'node:path';

import type { Rule } from 'eslint';

/** What each package may import, besides itself. A package never imports from its right. */
export const LAYERS: Readonly<Record<string, readonly string[]>> = {
  data: [],
  engine: ['data'],
  importers: ['data'],
  app: ['data', 'engine'],
};

const specifierOf = (node: Rule.Node): unknown => {
  const source = 'source' in node ? node.source : undefined;
  return source !== null && source !== undefined && 'value' in source ? source.value : undefined;
};

const packageOfFile = (file: string) =>
  /(?:^|\/)packages\/([^/]+)\//.exec(file.replaceAll('\\', '/'))?.[1];

const packageOfImport = (specifier: string, file: string) => {
  if (specifier.startsWith('.')) return packageOfFile(path.resolve(path.dirname(file), specifier));
  return /^@abacus\/([^/]+)/.exec(specifier)?.[1];
};

type Problem = { readonly messageId: 'alias' | 'layer'; readonly data: Record<string, string> };

const findProblem = (specifier: string, file: string): Problem | undefined => {
  const from = packageOfFile(file);
  const to = packageOfImport(specifier, file);
  if (from === undefined || to === undefined) return undefined;
  if (from === to) {
    return specifier.startsWith('@abacus/') ? { messageId: 'alias', data: { to } } : undefined;
  }
  if (LAYERS[from]?.includes(to) === true && !specifier.startsWith('.')) return undefined;
  return { messageId: 'layer', data: { from, to } };
};

export const layers: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      alias: 'Inside @abacus/{{to}}, import with `@/…` or a relative path.',
      layer:
        '{{from}} may not import this from {{to}}. Layers: data → engine → app, data → importers.',
    },
  },
  create: (context) => {
    const check = (node: Rule.Node) => {
      const specifier = specifierOf(node);
      if (typeof specifier !== 'string') return;
      const problem = findProblem(specifier, context.filename);
      if (problem !== undefined) context.report({ node, ...problem });
    };
    return {
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportDeclaration: check,
      ImportExpression: check,
      TSImportType: check,
    };
  },
};
