import type { ReductionBaselineDayInput } from '@aud-subjective/contracts';

import { Input } from '@/components/ui/input';

const statusLabels = {
  UNKNOWN: 'Unknown',
  KNOWN_ZERO: 'Known zero',
  KNOWN_QUANTITY: 'Known quantity',
} as const;

export function ReductionBaselineGrid({
  days,
  disabled,
  onChange,
}: {
  days: ReductionBaselineDayInput[];
  disabled?: boolean;
  onChange: (index: number, day: ReductionBaselineDayInput) => void;
}) {
  return (
    <div className="grid gap-3" aria-label="28-day alcohol baseline">
      {days.map((day, index) => (
        <div
          className="grid gap-3 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-[minmax(0,1fr)_10rem_8rem] sm:items-center"
          key={day.localDate}
        >
          <div>
            <p className="m-0 text-sm font-semibold">{day.localDate}</p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              Completed local calendar day
            </p>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Status
            <select
              aria-label={`Status for ${day.localDate}`}
              className="h-10 rounded-md border bg-surface px-2 text-sm text-foreground"
              disabled={disabled}
              value={day.status}
              onChange={(event) => {
                const status = event.target.value as ReductionBaselineDayInput['status'];
                onChange(index, {
                  localDate: day.localDate,
                  status,
                  standardDrinks:
                    status === 'UNKNOWN'
                      ? undefined
                      : status === 'KNOWN_ZERO'
                        ? 0
                        : day.standardDrinks && day.standardDrinks > 0
                          ? day.standardDrinks
                          : 0.1,
                });
              }}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Standard drinks
            {day.status === 'UNKNOWN' ? (
              <span className="flex h-10 items-center text-sm font-normal text-muted-foreground">
                Not supplied
              </span>
            ) : day.status === 'KNOWN_ZERO' ? (
              <span className="flex h-10 items-center text-sm font-normal text-foreground">
                0
              </span>
            ) : (
              <Input
                aria-label={`Standard drinks for ${day.localDate}`}
                disabled={disabled}
                min="0.1"
                step="0.1"
                type="number"
                value={day.standardDrinks ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onChange(index, {
                    ...day,
                    standardDrinks: value === '' ? undefined : Number(value),
                  });
                }}
              />
            )}
          </label>
        </div>
      ))}
    </div>
  );
}
