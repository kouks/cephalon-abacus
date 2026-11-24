import type { Library } from '@abacus/data/load/library';
import { scenarioSchema } from '@abacus/data/schema/scenario';
import { evaluate } from '@abacus/engine';

import { catalogOf } from './catalog';
import type { Reply, Request, Response } from './protocol';

const replyTo = (scenario: unknown, library: Library): Reply => {
  const parsed = scenarioSchema.safeParse(scenario);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      ({ path, message }) => `${path.join('.') || 'scenario'}: ${message}`,
    );
    return { status: 'invalid', problems };
  }
  try {
    return { status: 'evaluated', result: evaluate(parsed.data, library) };
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
};

export const handleRequest = (request: Request, library: Library): Response => {
  const { kind, id } = request;
  return kind === 'catalog'
    ? { kind, id, catalog: catalogOf(library) }
    : { kind, id, reply: replyTo(request.scenario, library) };
};
