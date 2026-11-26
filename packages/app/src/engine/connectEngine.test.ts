import { describe, expect, it } from 'vitest';

import { connectEngine } from './connectEngine';
import type { Port, Request, Response } from './protocol';

/** A Worker that answers when told to. */
const makeWorker = () => {
  const sent: Request[] = [];
  const listeners = new Map<string, (event: never) => void>();
  const port: Port<Response, Request> = {
    postMessage: (message) => sent.push(message),
    addEventListener: (type: string, listener: (event: never) => void) => {
      listeners.set(type, listener);
    },
  };
  const emit = (type: string, event: object) => listeners.get(type)?.(event as never);
  return {
    sent,
    engine: connectEngine(port),
    answer: (data: Response) => emit('message', { data }),
    crash: (message: string) => emit('error', { message }),
  };
};

const catalog = { weapons: [], targets: [] };

describe('the bridge', () => {
  it('matches answers to requests, in any order', async () => {
    const { engine, answer, sent } = makeWorker();
    const first = engine.catalog();
    const reply = engine.evaluate({});
    expect(sent.map(({ kind, id }) => [kind, id])).toEqual([
      ['catalog', 1],
      ['evaluate', 2],
    ]);
    answer({ kind: 'evaluate', id: 2, reply: { status: 'invalid', problems: ['no'] } });
    answer({ kind: 'catalog', id: 1, catalog });
    expect(await reply).toEqual({ status: 'invalid', problems: ['no'] });
    expect(await first).toEqual(catalog);
  });

  it('ignores an answer to nothing', async () => {
    const { engine, answer } = makeWorker();
    const first = engine.catalog();
    answer({ kind: 'catalog', id: 7, catalog: { weapons: [], targets: [] } });
    answer({ kind: 'catalog', id: 1, catalog });
    expect(await first).toBe(catalog);
  });

  it('fails what is pending when the Worker crashes', async () => {
    const { engine, crash } = makeWorker();
    const first = engine.catalog();
    const reply = engine.evaluate({});
    crash('The library is broken');
    await expect(first).rejects.toThrow('The library is broken');
    expect(await reply).toEqual({ status: 'failed', message: 'The library is broken' });
  });

  it('refuses an answer of the wrong kind', async () => {
    const { engine, answer } = makeWorker();
    const first = engine.catalog();
    answer({ kind: 'evaluate', id: 1, reply: { status: 'failed', message: '' } });
    await expect(first).rejects.toThrow('Unexpected response: evaluate');
    const reply = engine.evaluate({});
    answer({ kind: 'catalog', id: 2, catalog });
    const message = 'Unexpected response: catalog';
    expect(await reply).toEqual({ status: 'failed', message });
  });

  it('sends only the newest of the scenarios that wait', async () => {
    const { engine, answer, sent } = makeWorker();
    const replies = ['a', 'b', 'c'].map(engine.evaluate);
    answer({ kind: 'evaluate', id: 1, reply: { status: 'failed', message: 'old' } });
    expect(await replies[0]).toBeUndefined();
    expect(sent.map((request) => 'scenario' in request && request.scenario)).toEqual(['a', 'c']);
    answer({ kind: 'evaluate', id: 2, reply: { status: 'failed', message: 'new' } });
    expect(await replies[2]).toEqual({ status: 'failed', message: 'new' });
  });
});
