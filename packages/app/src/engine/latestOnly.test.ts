import { describe, expect, it } from 'vitest';

import { latestOnly } from './latestOnly';

/** A task that ends when told to. */
const makeTask = () => {
  const started: string[] = [];
  const finish: (() => void)[] = [];
  const run = (input: string) =>
    new Promise<string>((resolve) => {
      started.push(input);
      finish.push(() => {
        resolve(input.toUpperCase());
      });
    });
  return { started, finish, run: latestOnly(run) };
};

describe('latestOnly', () => {
  it('runs an input on its own', async () => {
    const { run, finish } = makeTask();
    const output = run('a');
    finish[0]?.();
    expect(await output).toBe('A');
  });

  it('skips those that a newer one replaced before they started', async () => {
    const { run, finish, started } = makeTask();
    const outputs = [run('a'), run('b'), run('c')];
    expect(await outputs[1]).toBeUndefined();
    finish[0]?.();
    expect(await outputs[0]).toBeUndefined();
    finish[1]?.();
    expect(await outputs[2]).toBe('C');
    expect(started).toEqual(['a', 'c']);
  });

  it('is ready again afterwards', async () => {
    const { run, finish, started } = makeTask();
    const first = run('a');
    finish[0]?.();
    await first;
    const second = run('b');
    finish[1]?.();
    expect(await second).toBe('B');
    expect(started).toEqual(['a', 'b']);
  });
});
