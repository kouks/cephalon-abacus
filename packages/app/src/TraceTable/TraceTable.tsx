import type { TraceRow } from '@/debug/traceRows';

export type TraceTableProps = { readonly rows: readonly TraceRow[] };

export const TraceTable = ({ rows }: TraceTableProps) => (
  <table>
    <caption>Trace: a type’s damage is the product of its factors and those for all types</caption>
    <thead>
      <tr>
        <th scope="col">Hit</th>
        <th scope="col">Factor</th>
        <th scope="col">Type</th>
        <th scope="col">Value</th>
        <th scope="col">From</th>
      </tr>
    </thead>
    <tbody>
      {rows.map(({ key, hit, factor, type, value, effects }) => (
        <tr key={key}>
          <td>{hit}</td>
          <td>{factor}</td>
          <td>{type}</td>
          <td>{value}</td>
          <td>{effects}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
