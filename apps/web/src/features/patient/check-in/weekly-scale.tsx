import type { WeeklyCheckInInstrumentProjection } from '@aud-subjective/contracts';

import { cn } from '@/lib/utils';

type ScaleItem = Extract<
  WeeklyCheckInInstrumentProjection['items'][number],
  { type: 'INTEGER_0_7' }
>;

export function WeeklyScale({
  item,
  value,
  onChange,
}: {
  item: ScaleItem;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const groupLabel = `${item.itemId} response`;

  return (
    <fieldset className="grid gap-4 rounded-xl border bg-surface p-5 sm:p-6">
      <legend className="max-w-2xl px-1 text-base font-semibold leading-6">
        {item.prompt}
      </legend>
      <div className="flex items-center justify-between gap-4 text-xs font-medium text-muted-foreground">
        <span>{item.anchors.zero}</span>
        <span className="text-right">{item.anchors.seven}</span>
      </div>
      <div
        aria-label={groupLabel}
        className="grid grid-cols-8 gap-1.5 sm:gap-2"
        role="radiogroup"
      >
        {Array.from({ length: 8 }, (_, score) => {
          const id = `${item.itemId}-${score}`;
          const selected = value === score;
          return (
            <label
              className={cn(
                'relative grid min-h-12 cursor-pointer place-items-center rounded-lg border text-sm font-semibold transition-colors',
                'hover:border-primary hover:bg-primary/5',
                'focus-within:ring-2 focus-within:ring-primary/30',
                selected
                  ? 'border-primary bg-primary text-inverse-foreground shadow-[var(--shadow-sm)]'
                  : 'border-border bg-surface-subtle text-foreground',
              )}
              htmlFor={id}
              key={id}
            >
              <input
                checked={selected}
                className="sr-only"
                id={id}
                name={item.itemId}
                onChange={() => onChange(score)}
                type="radio"
                value={score}
              />
              <span aria-hidden="true">{score}</span>
              <span className="sr-only">
                {score === 0
                  ? item.anchors.zero
                  : score === 7
                    ? item.anchors.seven
                    : `Score ${score}`}
              </span>
            </label>
          );
        })}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Choose one number from 0 to 7. Only the endpoints have descriptive
        anchors.
      </p>
    </fieldset>
  );
}

export function BooleanChoice({
  prompt,
  labels,
  value,
  onChange,
}: {
  prompt: string;
  labels: { false: string; true: string };
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="grid gap-4 rounded-xl border bg-surface p-5 sm:p-6">
      <legend className="px-1 text-base font-semibold leading-6">
        {prompt}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {[
          [false, labels.false],
          [true, labels.true],
        ].map(([choice, label]) => {
          const booleanChoice = choice as boolean;
          const selected = value === booleanChoice;
          const id = `U1-${String(choice)}`;
          return (
            <label
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-between rounded-lg border px-4 text-sm font-semibold transition-colors',
                'hover:border-primary hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/30',
                selected
                  ? 'border-primary bg-primary text-inverse-foreground'
                  : 'border-border bg-surface-subtle text-foreground',
              )}
              htmlFor={id}
              key={id}
            >
              <span>{label}</span>
              <input
                checked={selected}
                className="size-4 accent-current"
                id={id}
                name="U1"
                onChange={() => onChange(booleanChoice)}
                type="radio"
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
