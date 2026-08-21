import type { WeeklyConsumptionDraftDay } from '@aud-subjective/contracts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function dayForDate(days: WeeklyConsumptionDraftDay[], localDate: string) {
  return days.find((day) => day.localDate === localDate);
}

export function WeeklyConsumptionCalendar({
  dates,
  days,
  onChange,
}: {
  dates: string[];
  days: WeeklyConsumptionDraftDay[];
  onChange: (days: WeeklyConsumptionDraftDay[]) => void;
}) {
  const setDay = (
    localDate: string,
    changes: Partial<WeeklyConsumptionDraftDay>,
  ) => {
    const existing = dayForDate(days, localDate);
    const next = {
      localDate,
      status: existing?.status ?? 'UNKNOWN',
      ...existing,
      ...changes,
    } as WeeklyConsumptionDraftDay;
    if (next.status === 'UNKNOWN' || next.standardDrinks === undefined) {
      delete next.standardDrinks;
    }
    const rest = days.filter((day) => day.localDate !== localDate);
    onChange(
      [...rest, next].sort((left, right) =>
        left.localDate.localeCompare(right.localDate),
      ),
    );
  };

  const setStatus = (
    localDate: string,
    status: WeeklyConsumptionDraftDay['status'],
  ) => {
    if (status === 'UNKNOWN') {
      setDay(localDate, { status });
    } else if (status === 'KNOWN_ZERO') {
      setDay(localDate, { status, standardDrinks: 0 });
    } else {
      setDay(localDate, { status });
    }
  };

  return (
    <section className="grid gap-4 rounded-xl border bg-surface p-5 sm:p-6">
      <div>
        <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary">
          Your week
        </p>
        <h2 className="mb-0 mt-2 text-xl font-semibold">
          Add any alcohol days you want to record
        </h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          Each day is optional while you are drafting. Unknown is different from
          zero drinks.
        </p>
      </div>
      <div className="grid gap-3">
        {dates.map((localDate) => {
          const day = dayForDate(days, localDate);
          const quantity =
            day?.status === 'KNOWN_QUANTITY' ? day.standardDrinks : undefined;
          return (
            <div
              className="grid gap-3 rounded-lg border bg-surface-subtle p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={localDate}
            >
              <div>
                <p className="m-0 font-semibold">
                  {formatLocalDate(localDate)}
                </p>
                <p className="m-0 text-xs text-muted-foreground">{localDate}</p>
              </div>
              <div className="grid gap-2 sm:justify-items-end">
                <div className="flex flex-wrap gap-2" role="group">
                  {(
                    [
                      ['KNOWN_ZERO', '0 drinks'],
                      ['KNOWN_QUANTITY', 'Quantity'],
                      ['UNKNOWN', 'Unknown'],
                    ] as const
                  ).map(([status, label]) => (
                    <Button
                      className="min-h-9 px-3 text-xs"
                      key={status}
                      onClick={() => setStatus(localDate, status)}
                      type="button"
                      variant={day?.status === status ? 'primary' : 'outline'}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {day?.status === 'KNOWN_QUANTITY' ? (
                  <label className="grid max-w-36 gap-1 text-xs font-semibold">
                    Standard drinks
                    <Input
                      aria-label={`Standard drinks on ${localDate}`}
                      inputMode="decimal"
                      min="0.1"
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === '') {
                          setStatus(localDate, 'UNKNOWN');
                        } else {
                          setDay(localDate, {
                            status: 'KNOWN_QUANTITY',
                            standardDrinks: Number(next),
                          });
                        }
                      }}
                      placeholder="e.g. 1.5"
                      step="0.1"
                      type="number"
                      value={quantity === undefined ? '' : String(quantity)}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className={cn('m-0 text-xs text-muted-foreground')}>
        Quantities use the existing standard-drink policy and at most one
        decimal place.
      </p>
    </section>
  );
}

function formatLocalDate(localDate: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T12:00:00Z`));
}
