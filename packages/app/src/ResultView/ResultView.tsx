import type { HeadlineNumber, Outcome } from '@/debug/outcome';
import { Headline } from '@/Headline/Headline';
import { TraceTable } from '@/TraceTable/TraceTable';

export type ResultViewProps = { readonly outcome: Outcome };

const Problems = ({ problems }: { readonly problems: readonly string[] }) => (
  <ul>
    {problems.map((problem) => (
      <li key={problem}>{problem}</li>
    ))}
  </ul>
);

const Enemy = ({ numbers }: { readonly numbers: readonly HeadlineNumber[] }) =>
  numbers.length === 0 ? null : (
    <>
      <h3>Enemy at its level</h3>
      <Headline numbers={numbers} />
    </>
  );

const Body = ({ outcome }: ResultViewProps) => {
  if (outcome.kind === 'waiting') return <p>Waiting for the engine</p>;
  if (outcome.kind === 'problems') return <Problems problems={outcome.problems} />;
  return (
    <>
      <Headline numbers={outcome.headline} />
      <Enemy numbers={outcome.enemy} />
      <Problems problems={outcome.warnings} />
      <TraceTable rows={outcome.rows} />
      <h3>Result, as JSON</h3>
      <pre>{outcome.json}</pre>
    </>
  );
};

export const ResultView = ({ outcome }: ResultViewProps) => (
  <section aria-label="Result">
    <h2>Result</h2>
    <p role="status">{outcome.kind === 'problems' ? 'The scenario has problems' : ''}</p>
    <Body outcome={outcome} />
  </section>
);
