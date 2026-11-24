import { latestOnly } from './latestOnly';
import type { Catalog, Port, Reply, Request, Response } from './protocol';

/** The engine, as the rest of the app sees it. */
export type Engine = {
  readonly catalog: () => Promise<Catalog>;
  /** Undefined if a newer scenario came along first. */
  readonly evaluate: (scenario: unknown) => Promise<Reply | undefined>;
};

type Pending = {
  readonly resolve: (response: Response) => void;
  readonly reject: (error: Error) => void;
};

type Body =
  { readonly kind: 'catalog' } | { readonly kind: 'evaluate'; readonly scenario: unknown };

/** Sends requests and matches each response to its own. */
const makeSend = (port: Port<Response, Request>) => {
  const pending = new Map<number, Pending>();
  let lastId = 0;

  port.addEventListener('message', ({ data }) => {
    pending.get(data.id)?.resolve(data);
    pending.delete(data.id);
  });
  port.addEventListener('error', ({ message }) => {
    for (const { reject } of pending.values()) reject(new Error(message));
    pending.clear();
  });

  return (body: Body) =>
    new Promise<Response>((resolve, reject) => {
      lastId += 1;
      pending.set(lastId, { resolve, reject });
      port.postMessage({ ...body, id: lastId });
    });
};

const unexpected = ({ kind }: Response) => new Error(`Unexpected response: ${kind}`);

export const connectEngine = (port: Port<Response, Request>): Engine => {
  const send = makeSend(port);

  const catalog = async () => {
    const response = await send({ kind: 'catalog' });
    if (response.kind !== 'catalog') throw unexpected(response);
    return response.catalog;
  };

  const evaluate = async (scenario: unknown): Promise<Reply> => {
    try {
      const response = await send({ kind: 'evaluate', scenario });
      if (response.kind !== 'evaluate') throw unexpected(response);
      return response.reply;
    } catch (error) {
      return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  };

  return { catalog, evaluate: latestOnly(evaluate) };
};
