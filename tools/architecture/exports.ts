import ts from 'typescript';

import { parse } from './repo.ts';

export type Exported = { readonly name: string; readonly isType: boolean };

const isExported = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword);

const fromList = (node: ts.ExportDeclaration): readonly Exported[] => {
  if (node.exportClause === undefined || !ts.isNamedExports(node.exportClause)) {
    return [{ name: '*', isType: node.isTypeOnly }];
  }
  return node.exportClause.elements.map((element) => ({
    name: element.name.text,
    isType: node.isTypeOnly || element.isTypeOnly,
  }));
};

const fromDeclaration = (node: ts.Statement): readonly Exported[] => {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.map(({ name }) => ({
      name: name.getText(),
      isType: false,
    }));
  }
  if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    return [{ name: node.name.text, isType: true }];
  }
  const isNamed = ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node);
  return [{ name: isNamed ? (node.name?.text ?? 'default') : node.getText(), isType: false }];
};

/** Every name a module exports. */
export const exportsOf = (text: string): readonly Exported[] =>
  parse(text).statements.flatMap((node) => {
    if (ts.isExportDeclaration(node)) return fromList(node);
    if (ts.isExportAssignment(node)) return [{ name: 'default', isType: false }];
    return isExported(node) ? fromDeclaration(node) : [];
  });
