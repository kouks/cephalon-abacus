/**
 * Shared option lists. When two config blocks set the same rule on a file, the later block replaces
 * the earlier one, so every block that sets `no-restricted-syntax` or
 * `@typescript-eslint/no-restricted-imports` must spread these.
 */

export type RestrictedSyntax = { readonly selector: string; readonly message: string };

export type RestrictedImportPattern = {
  readonly regex: string;
  readonly message: string;
  readonly allowTypeImports?: boolean;
};

export const BASE_SYNTAX: readonly RestrictedSyntax[] = [
  {
    selector: 'TSEnumDeclaration',
    message: 'Use an `as const` object and a union type, not an enum.',
  },
  {
    selector: 'ExportAllDeclaration',
    message: 'No barrels: import from the file that declares the name.',
  },
  {
    selector: "ExportNamedDeclaration[source][exportKind='value']",
    message: 'No barrels: import from the file that declares the name.',
  },
  {
    selector: 'VariableDeclarator > FunctionExpression',
    message: 'Write an arrow function.',
  },
];

export const BASE_RESTRICTED_IMPORTS: readonly RestrictedImportPattern[] = [
  {
    regex: String.raw`(^|/)\.\.(/[^/]+)*/\.\.(/|$)`,
    message: 'At most one level up. Use `@/…` inside a package.',
  },
];

/** Raw colours and React Aria traps, banned in the app. */
export const APP_SYNTAX: readonly RestrictedSyntax[] = [
  {
    selector: "JSXAttribute[name.name='isInvalid'][value.expression.value=false]",
    message: 'Leave `isInvalid` out instead of passing false.',
  },
  {
    selector: 'ImportExpression[source.value=/^@abacus\\u002Fengine/]',
    message: 'Only src/engine/ may load the engine.',
  },
];

const COLOUR = String.raw`/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|(?:rgb|hsl)a?\(/i`;
const COLOUR_MESSAGE = 'Raw colours live in the theme. Use a theme value.';

export const COLOUR_SYNTAX: readonly RestrictedSyntax[] = [
  { selector: `Literal[value=${COLOUR}]`, message: COLOUR_MESSAGE },
  { selector: `TemplateElement[value.raw=${COLOUR}]`, message: COLOUR_MESSAGE },
];
