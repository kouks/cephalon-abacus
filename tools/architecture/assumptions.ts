import type { Assumption } from '#engine/assumptions.ts';

/** Every assumption names a test from BIBLE §16 and a section the BIBLE has. */
export const checkAssumptions = (
  assumptions: Readonly<Record<string, Assumption>>,
  bible: string,
): readonly string[] =>
  Object.entries(assumptions).flatMap(([flag, { test, bible: section }]) => {
    const hasTest = new RegExp(String.raw`^\| ${test}\s*\|`, 'm').test(bible);
    const hasSection = bible.includes(`\n## ${section.slice(1)}. `);
    return [
      ...(hasTest ? [] : [`${flag} names ${test}, which BIBLE §16 does not list.`]),
      ...(hasSection ? [] : [`${flag} names ${section}, which the BIBLE does not have.`]),
    ];
  });
