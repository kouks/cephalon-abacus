import { currentBranch } from './currentBranch.ts';
import { report } from './report.ts';
import { checkBranch } from './rules.ts';

report(checkBranch(currentBranch()));
