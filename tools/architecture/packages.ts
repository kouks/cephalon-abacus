import { LAYERS } from '#eslint/rules/layers.ts';

/** Workspace packages that `name` depends on or references but its layer may not import. */
export const checkPackage = (name: string, uses: readonly string[]): readonly string[] => {
  const allowed = LAYERS[name];
  if (allowed === undefined) return [`${name} has no layer in eslint/rules/layers.ts.`];
  return uses
    .filter((used) => !allowed.includes(used))
    .map((used) => `${name} may not depend on ${used}.`);
};
