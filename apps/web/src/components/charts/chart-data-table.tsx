import type { ReactNode } from 'react';

export type ChartTablePoint = {
  label: string;
  value: number | null;
  status: 'MISSING' | 'PARTIAL' | 'COMPLETE';
  detail?: ReactNode;
};

export function ChartDataTable({
  label,
  points,
}: {
  label: string;
  points: readonly ChartTablePoint[];
}) {
  return (
    <details className="rounded-lg border bg-surface-subtle">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline-none">
        View accessible data table
      </summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full border-collapse text-left text-sm" aria-label={label}>
          <thead className="bg-surface-interactive text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3" scope="col">
                Period
              </th>
              <th className="px-4 py-3" scope="col">
                Value
              </th>
              <th className="px-4 py-3" scope="col">
                Coverage
              </th>
              <th className="px-4 py-3" scope="col">
                Context
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr className="border-t" key={point.label}>
                <th className="px-4 py-3 font-medium" scope="row">
                  {point.label}
                </th>
                <td className="px-4 py-3 font-semibold">
                  {point.value === null ? 'No value recorded' : `${point.value} / 7`}
                </td>
                <td className="px-4 py-3">{point.status.toLowerCase()}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {point.detail ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
