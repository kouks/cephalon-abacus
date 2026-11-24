import ts from 'typescript';

import { exportsOf } from './exports.ts';
import { nodesOf } from './repo.ts';

const SUFFIXES = ['.tsx', '.hooks.ts', '.css.ts', '.test.tsx', '.stories.tsx'];

/** A component folder holds its view, hook, styles, test and stories, and nothing else. */
export const checkFolder = (name: string, entries: readonly string[]): readonly string[] => {
  const allowed = SUFFIXES.map((suffix) => `${name}${suffix}`);
  const problems = entries
    .filter((entry) => !allowed.includes(entry))
    .map((entry) => `${name}/${entry} does not belong in a component folder.`);
  return entries.includes(`${name}.tsx`) ? problems : [...problems, `${name}/ has no ${name}.tsx.`];
};

const HOOK = /^use(?:[A-Z]|$)/;

const calleeOf = ({ expression }: ts.CallExpression) =>
  ts.isPropertyAccessExpression(expression) ? expression.name.text : expression.getText();

const hookCalls = (text: string) =>
  nodesOf(text)
    .filter((node) => ts.isCallExpression(node))
    .map(calleeOf)
    .filter((callee) => HOOK.test(callee));

/** `Foo.tsx` exports `Foo` (and `FooProps`) only, and calls no hook but `useFoo`, once. */
export const checkView = (name: string, text: string): readonly string[] => {
  const exported = exportsOf(text);
  const allowed = [name, `${name}Props`];
  const calls = hookCalls(text);
  const problems = [
    ...exported
      .filter((entry) => !allowed.includes(entry.name))
      .map((entry) => `${name}.tsx exports ${entry.name}.`),
    ...calls.filter((call) => call !== `use${name}`).map((call) => `${name}.tsx calls ${call}.`),
  ];
  if (!exported.some((entry) => entry.name === name))
    problems.push(`${name}.tsx exports no ${name}.`);
  if (calls.filter((call) => call === `use${name}`).length > 1) {
    problems.push(`${name}.tsx calls use${name} more than once.`);
  }
  return problems;
};

/** `Foo.hooks.ts` exports one value, `useFoo`. */
export const checkHooks = (name: string, text: string): readonly string[] => {
  const values = exportsOf(text).filter(({ isType }) => !isType);
  const isRight = values.length === 1 && values[0]?.name === `use${name}`;
  const found = values.map((entry) => entry.name).join(', ') || 'nothing';
  return isRight ? [] : [`${name}.hooks.ts must export use${name} only; it exports ${found}.`];
};
