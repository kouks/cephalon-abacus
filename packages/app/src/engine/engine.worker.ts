import { formatError } from '@abacus/data/load/libraryError';
import { loadLibrary } from '@abacus/data/load/loadLibrary';

import { handleRequest } from './handleRequest';
import { libraryFiles } from './libraryFiles';
import type { Port, Request, Response } from './protocol';

const loaded = loadLibrary(libraryFiles);
if (!loaded.ok) throw new Error(loaded.errors.map(formatError).join('\n'));

const page: Port<Request, Response> = self;

page.addEventListener('message', ({ data }) => {
  page.postMessage(handleRequest(data, loaded.library));
});
