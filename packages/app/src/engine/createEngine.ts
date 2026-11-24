import type { Engine } from './connectEngine';
import { connectEngine } from './connectEngine';

/** Starts the engine in a Web Worker. */
export const createEngine = (): Engine =>
  connectEngine(new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' }));
