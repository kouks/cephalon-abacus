import type { Result } from '@abacus/engine';

export type Named = { readonly id: string; readonly name: string };

/** What can be picked. */
export type Catalog = {
  readonly weapons: readonly (Named & {
    /** The modules that fit it. */
    readonly modules: readonly Named[];
  })[];
};

/** The answer to a scenario: a result, what is wrong with the scenario, or what went wrong. */
export type Reply =
  | { readonly status: 'evaluated'; readonly result: Result }
  | { readonly status: 'invalid'; readonly problems: readonly string[] }
  | { readonly status: 'failed'; readonly message: string };

export type Request =
  | { readonly kind: 'catalog'; readonly id: number }
  | { readonly kind: 'evaluate'; readonly id: number; readonly scenario: unknown };

export type Response =
  | { readonly kind: 'catalog'; readonly id: number; readonly catalog: Catalog }
  | { readonly kind: 'evaluate'; readonly id: number; readonly reply: Reply };

/** One end of a channel: a Worker as the page sees it, or the page as the Worker does. */
export type Port<Incoming, Outgoing> = {
  readonly postMessage: (message: Outgoing) => void;
  readonly addEventListener: {
    (type: 'message', listener: (event: MessageEvent<Incoming>) => void): void;
    (type: 'error', listener: (event: ErrorEvent) => void): void;
  };
};
