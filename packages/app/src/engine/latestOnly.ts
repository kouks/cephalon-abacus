type Waiting<Input, Output> = {
  readonly input: Input;
  readonly resolve: (output: Output | undefined) => void;
};

/**
 * Runs one input at a time, and only the newest of those that wait. An input that a newer one
 * replaced resolves to undefined, even if it was already running.
 */
export const latestOnly = <Input, Output>(run: (input: Input) => Promise<Output>) => {
  let isBusy = false;
  let waiting: Waiting<Input, Output> | undefined;

  const start = async ({ input, resolve }: Waiting<Input, Output>): Promise<void> => {
    isBusy = true;
    const output = await run(input);
    isBusy = false;
    const next = waiting;
    waiting = undefined;
    resolve(next === undefined ? output : undefined);
    if (next !== undefined) await start(next);
  };

  return (input: Input) =>
    new Promise<Output | undefined>((resolve) => {
      if (!isBusy) {
        void start({ input, resolve });
        return;
      }
      waiting?.resolve(undefined);
      waiting = { input, resolve };
    });
};
