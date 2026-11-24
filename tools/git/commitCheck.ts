/**
 * `commitCheck.ts <file>`: fills in a missing ticket scope, then checks the message (commit-msg hook).
 * `commitCheck.ts --text "…" [--branch <name>]`: checks a string. With a branch, checks that as well
 * (pull request titles).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { currentBranch } from './currentBranch.ts';
import { report } from './report.ts';
import { checkBranch, checkHeader, fillScope, headerOf } from './rules.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { branch: { type: 'string' }, text: { type: 'string' } },
});

const checkText = (text: string) => {
  if (values.branch === undefined) return checkHeader(text, currentBranch());
  return [...checkBranch(values.branch), ...checkHeader(text, values.branch)];
};

const checkFile = (file: string) => {
  const branch = currentBranch();
  const message = readFileSync(file, 'utf8');
  const filled = fillScope(message, branch);
  if (filled !== message) writeFileSync(file, filled);
  return checkHeader(headerOf(filled), branch);
};

const [file] = positionals;

if (values.text !== undefined) report(checkText(values.text));
else if (file !== undefined) report(checkFile(file));
else report(['Pass a commit message file, or --text "…".']);
