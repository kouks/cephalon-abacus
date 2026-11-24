import type { Assumption } from '#engine/assumptions.ts';

const TEST = /^T-[1-9][0-9]*$/;
const SECTION = /^§[1-9][0-9]*$/;

/** Every assumption cites an in-game test and a BIBLE section. The BIBLE itself is not in the repo. */
export const checkAssumptions = (
  assumptions: Readonly<Record<string, Assumption>>,
): readonly string[] =>
  Object.entries(assumptions).flatMap(([flag, { test, bible }]) => [
    ...(TEST.test(test) ? [] : [`${flag} cites "${test}", which is not a test like T-5.`]),
    ...(SECTION.test(bible) ? [] : [`${flag} cites "${bible}", which is not a section like §7.`]),
  ]);
