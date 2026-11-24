import type { HeadlineNumber } from '@/debug/outcome';

export type HeadlineProps = { readonly numbers: readonly HeadlineNumber[] };

export const Headline = ({ numbers }: HeadlineProps) => (
  <dl>
    {numbers.map(({ label, value }) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);
