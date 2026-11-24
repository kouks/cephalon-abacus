import { spawnSync } from 'node:child_process';

/** The checked-out branch, or an empty string when HEAD is detached. */
export const currentBranch = () =>
  spawnSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
