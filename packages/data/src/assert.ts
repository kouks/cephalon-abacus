/** The value, or an error if it is missing. Use it instead of a non-null `!`. */
export const must = <T>(value: T, message: string): NonNullable<T> => {
  if (value === null || value === undefined) throw new Error(message);
  return value;
};

/** Stops when something the code relies on is not true. */
export const invariant: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(message);
};

/** Ends an exhaustive `switch`: it stops compiling when a case is missing. */
export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
};
