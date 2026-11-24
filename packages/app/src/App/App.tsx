import { DebugPage } from '@/DebugPage/DebugPage';
import type { Engine } from '@/engine/connectEngine';

export type AppProps = { readonly engine: Engine };

export const App = ({ engine }: AppProps) => (
  <main>
    <h1>Cephalon Abacus</h1>
    <DebugPage engine={engine} />
  </main>
);
