import type { Module } from '@abacus/data/schema/module';

import type { CollectedEffect, Warning } from './types';

/** The first module to lock each bucket. */
const findLocks = (modules: readonly Module[]) => {
  const locks = new Map<string, string>();
  for (const { id, locks: names = [] } of modules) {
    for (const name of names) {
      if (!locks.has(name)) locks.set(name, id);
    }
  }
  return locks;
};

const warningKey = (warning: Warning) => JSON.stringify(warning);

/** Drops the effects on buckets a module locks, whatever their source. */
export const applyLocks = (effects: readonly CollectedEffect[], modules: readonly Module[]) => {
  const locks = findLocks(modules);
  const warnings = new Map<string, Warning>();

  const free = effects.filter(({ bucket, source }) => {
    const lockedBy = locks.get(bucket);
    if (lockedBy === undefined) return true;
    const warning: Warning = { code: 'lockedBucket', sourceId: source.id, bucket, lockedBy };
    warnings.set(warningKey(warning), warning);
    return false;
  });
  return { effects: free, warnings: [...warnings.values()] };
};
