import ts from 'typescript';

import { nodesOf } from './repo.ts';

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

const isId = (node: ts.Node) => {
  const name = ts.isPropertyAccessExpression(node) ? node.name.text : node.getText();
  return /^(?:id|\w+Id)$/.test(name);
};

const isIdComparison = (node: ts.Node) =>
  ts.isBinaryExpression(node) &&
  EQUALITY.has(node.operatorToken.kind) &&
  ((isId(node.left) && ts.isStringLiteralLike(node.right)) ||
    (ts.isStringLiteralLike(node.left) && isId(node.right)));

const isIdSwitch = (node: ts.Node) =>
  ts.isSwitchStatement(node) &&
  isId(node.expression) &&
  node.caseBlock.clauses.some((clause) => ts.isCaseClause(clause));

/** Places where engine code branches on an item's id, or names one from the library. */
export const findIdLiterals = (text: string, libraryIds: ReadonlySet<string>): readonly string[] =>
  nodesOf(text).flatMap((node) => {
    if (isIdComparison(node) || isIdSwitch(node)) {
      return [`Branches on an id: ${node.getText().split('\n')[0] ?? ''}`];
    }
    const isLibraryId = ts.isStringLiteralLike(node) && libraryIds.has(node.text);
    return isLibraryId ? [`Names a library item: ${node.getText()}`] : [];
  });
