import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartDataTable, type ChartTablePoint } from './chart-data-table';
import { ChartFrame } from './chart-frame';

export type TrendPoint = ChartTablePoint & {
  shortLabel: string;
};

export function TrendChart({
  title,
  description,
  data,
  target,
}: {
  title: string;
  description: string;
  data: readonly TrendPoint[];
  target?: number;
}) {
  const hasValues = data.some((point) => point.value !== null);
  return (
    <ChartFrame
      description={description}
      fallback={<ChartDataTable label={`${title} data`} points={data} />}
      title={title}
    >
      <div
        aria-label={`${title}. Values are shown on a 0 to 7 scale. Missing periods remain gaps.`}
        className="h-72 w-full"
        role="img"
      >
        {hasValues ? (
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: -18 }}>
              <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 3" />
              <XAxis
                axisLine={false}
                dataKey="shortLabel"
                tick={{ fill: 'var(--foreground-secondary)', fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={[0, 7]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                tick={{ fill: 'var(--foreground-secondary)', fontSize: 12 }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '0.75rem',
                }}
                formatter={(value) => [value ?? 'No value', 'Recorded value']}
                labelFormatter={(label) => `Week of ${label}`}
              />
              {target !== undefined ? (
                <ReferenceLine
                  label={{ value: 'Target', fill: 'var(--foreground-secondary)' }}
                  stroke="var(--action-primary)"
                  strokeDasharray="5 5"
                  y={target}
                />
              ) : null}
              <Line
                activeDot={{ r: 5 }}
                connectNulls={false}
                dataKey="value"
                dot={{ fill: 'var(--action-primary)', r: 4 }}
                isAnimationActive={false}
                name="Recorded value"
                stroke="var(--action-primary)"
                strokeWidth={3}
                type="linear"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-lg border border-dashed bg-surface-subtle px-6 text-center text-sm text-muted-foreground">
            There are no recorded values in this window. Scheduled periods remain visible in the table below.
          </div>
        )}
      </div>
    </ChartFrame>
  );
}
