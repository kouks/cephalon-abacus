const TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'style',
  'test',
  'docs',
  'build',
  'ci',
  'chore',
  'revert',
];
const TYPE = `(?:${TYPES.join('|')})`;

const BRANCH = new RegExp(`^${TYPE}/aba-([1-9][0-9]*)-[a-z0-9]+(?:-[a-z0-9]+)*$`);
const HEADER = new RegExp(String.raw`^${TYPE}\(ABA-([1-9][0-9]*)\)!?: [a-z].*$`);
const UNSCOPED = new RegExp(`^(${TYPE})(!?: .*)$`);
const DEPENDABOT_HEADER = /^chore\(deps(?:-dev)?\): /;

const MAX_HEADER = 72;

const isDependabot = (branch: string) => branch.startsWith('dependabot/');

/** The ticket a branch belongs to (`ABA-14`), or undefined when it names none. */
export const ticketOf = (branch: string) => {
  const number = BRANCH.exec(branch)?.[1];
  return number === undefined ? undefined : `ABA-${number}`;
};

export const checkBranch = (branch: string): readonly string[] => {
  if (isDependabot(branch) || ticketOf(branch) !== undefined) return [];
  const name = branch === '' ? 'A detached HEAD' : `Branch "${branch}"`;
  return [`${name} does not match <type>/aba-<n>-<short-topic>, e.g. feat/aba-14-quantization.`];
};

/** What is wrong with a commit header or a pull request title on `branch`. */
export const checkHeader = (header: string, branch: string): readonly string[] => {
  if (isDependabot(branch) && DEPENDABOT_HEADER.test(header)) return [];

  const problems: string[] = [];
  if (header.length > MAX_HEADER) {
    problems.push(`The header is ${header.length} characters; the limit is ${MAX_HEADER}.`);
  }
  const number = HEADER.exec(header)?.[1];
  if (number === undefined) {
    problems.push(`"${header}" does not match type(ABA-n)!: summary. Types: ${TYPES.join(', ')}.`);
    return problems;
  }
  const ticket = ticketOf(branch);
  if (ticket !== undefined && ticket !== `ABA-${number}`) {
    problems.push(`The header names ABA-${number}, but the branch belongs to ${ticket}.`);
  }
  return problems;
};

const isContent = (line: string) => line.trim() !== '' && !line.startsWith('#');

/** The first line of a commit message that Git will keep. */
export const headerOf = (message: string) => message.split('\n').find(isContent)?.trim() ?? '';

/** Adds the branch's ticket as the scope of a header that has none. */
export const fillScope = (message: string, branch: string) => {
  const ticket = ticketOf(branch);
  const lines = message.split('\n');
  const index = lines.findIndex(isContent);
  const [, type, rest] = UNSCOPED.exec(lines[index]?.trim() ?? '') ?? [];
  if (ticket === undefined || type === undefined || rest === undefined) return message;
  return lines.with(index, `${type}(${ticket})${rest}`).join('\n');
};
