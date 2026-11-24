import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../..');

/** Repository files matching a glob, as paths from the root. */
export const filesIn = (glob: string) =>
  globSync(glob, { cwd: ROOT, exclude: ['**/node_modules/**', '**/dist/**'] })
    .map((file) => file.replaceAll('\\', '/'))
    .sort();

export const readText = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

export const readJson = (file: string): unknown => JSON.parse(readText(file));

export const parse = (text: string) =>
  ts.createSourceFile('file.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/** Every node of a file, parents before children. */
export const nodesOf = (text: string): readonly ts.Node[] => {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(parse(text));
  return nodes;
};
