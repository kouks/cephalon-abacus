/** Prints each problem and fails the process if there are any. */
export const report = (problems: readonly string[]) => {
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exitCode = 1;
};
