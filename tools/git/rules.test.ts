import { describe, expect, it } from 'vitest';

import { checkBranch, checkHeader, fillScope, headerOf, ticketOf } from './rules.ts';

const BRANCH = 'feat/aba-14-quantization';
const DEPENDABOT = 'dependabot/npm_and_yarn/minor-and-patch-1a2b';

describe('checkBranch', () => {
  it.each([BRANCH, 'fix/aba-22-armor-cap', 'build/aba-5-scaffold', DEPENDABOT])(
    'accepts %s',
    (branch) => {
      expect(checkBranch(branch)).toEqual([]);
    },
  );

  it.each([
    'main',
    '',
    'koukskoch/aba-14-quantization',
    'feat/aba-14',
    'feat/aba-0-quantization',
    'feat/aba-014-quantization',
    'feat/ABA-14-quantization',
    'feat/aba-14-Quantization',
    'feat/aba-14-quantization-',
    'feat/aba-14--quantization',
    'feat/xyz-14-quantization',
    'feature/aba-14-quantization',
  ])('refuses "%s"', (branch) => {
    expect(checkBranch(branch)).toHaveLength(1);
  });
});

describe('ticketOf', () => {
  it('reads the ticket from the branch', () => {
    expect(ticketOf(BRANCH)).toBe('ABA-14');
  });

  it('finds none on main', () => {
    expect(ticketOf('main')).toBeUndefined();
  });
});

describe('checkHeader', () => {
  it.each([
    'feat(ABA-14): quantize damage types to 1/32 of base damage',
    'feat(ABA-14)!: rename the crit bucket',
  ])('accepts "%s"', (header) => {
    expect(checkHeader(header, BRANCH)).toEqual([]);
  });

  it.each([
    'feat: quantize',
    'feat(ABA-14) quantize',
    'feat(ABA-14): Quantize',
    'feat(aba-14): quantize',
    'feat(ABA-0): quantize',
    'feature(ABA-14): quantize',
    'Merge branch main',
    'fixup! feat(ABA-14): quantize',
    'chore(deps): bump vite',
    '',
  ])('refuses "%s"', (header) => {
    expect(checkHeader(header, BRANCH)).toHaveLength(1);
  });

  it('refuses a scope that names another ticket', () => {
    expect(checkHeader('feat(ABA-15): quantize', BRANCH)).toEqual([
      'The header names ABA-15, but the branch belongs to ABA-14.',
    ]);
  });

  it('allows 72 characters and refuses 73', () => {
    const header = 'feat(ABA-14): '.padEnd(72, 'a');
    expect(checkHeader(header, BRANCH)).toEqual([]);
    expect(checkHeader(`${header}a`, BRANCH)).toHaveLength(1);
  });

  it("exempts only Dependabot's own chore(deps) titles", () => {
    expect(checkHeader('chore(deps): bump the minor-and-patch group', DEPENDABOT)).toEqual([]);
    expect(checkHeader('chore(deps-dev): bump vite from 8.3.8 to 8.3.9', DEPENDABOT)).toEqual([]);
    expect(checkHeader('feat: add a thing', DEPENDABOT)).toHaveLength(1);
  });
});

describe('headerOf', () => {
  it('skips blank lines and comments', () => {
    expect(headerOf('\n# Please enter the message\nfeat: add\n\nbody')).toBe('feat: add');
  });
});

describe('fillScope', () => {
  it('adds the ticket to a header without a scope', () => {
    expect(fillScope('feat: add rounding\n\nbody', BRANCH)).toBe(
      'feat(ABA-14): add rounding\n\nbody',
    );
  });

  it('keeps the breaking-change mark', () => {
    expect(fillScope('feat!: add rounding', BRANCH)).toBe('feat(ABA-14)!: add rounding');
  });

  it('copies the summary exactly, dollar signs included', () => {
    expect(fillScope("feat: add $& and $' to x", BRANCH)).toBe("feat(ABA-14): add $& and $' to x");
  });

  it.each([
    ['another scope', 'feat(ABA-15): add', BRANCH],
    ['an unknown type', 'feature: add', BRANCH],
    ['a branch without a ticket', 'feat: add', 'main'],
  ])('leaves %s alone', (_name, message, branch) => {
    expect(fillScope(message, branch)).toBe(message);
  });
});
