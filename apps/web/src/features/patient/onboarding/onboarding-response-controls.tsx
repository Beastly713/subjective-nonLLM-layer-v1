import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ResponseValue } from './types';

const missingStates = [
  ['UNKNOWN', 'Unknown'],
  ['UNSURE', 'Unsure'],
  ['PREFER_NOT_TO_SAY', 'Prefer not to say'],
  ['NOT_YET_ANSWERED', 'Not answered'],
] as const;

export function ResponseControls<T>({
  label,
  value,
  options,
  onChange,
  helpText,
  disabled = false,
}: {
  label: string;
  value: ResponseValue<T>;
  options: readonly { value: T; label: string }[];
  onChange: (value: ResponseValue<T>) => void;
  helpText?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <legend className="text-sm font-semibold">{label}</legend>
      {helpText ? (
        <p className="m-0 text-sm text-muted-foreground">{helpText}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Button
            className="justify-start text-left"
            key={String(option.value)}
            onClick={() => onChange({ state: 'ANSWERED', value: option.value })}
            type="button"
            variant={
              value.state === 'ANSWERED' && value.value === option.value
                ? 'primary'
                : 'outline'
            }
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {missingStates.map(([state, stateLabel]) => (
          <Button
            className="min-h-9 px-3 text-xs"
            key={state}
            onClick={() => onChange({ state })}
            type="button"
            variant={value.state === state ? 'secondary' : 'ghost'}
          >
            {stateLabel}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

export function NumericResponseField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  helpText,
}: {
  label: string;
  value: ResponseValue<number>;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: ResponseValue<number>) => void;
  helpText?: string;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <label className="grid gap-2 text-sm font-semibold">
        {label}
        <Input
          inputMode="decimal"
          max={max}
          min={min}
          onChange={(event) => {
            if (event.target.value === '') {
              onChange({ state: 'NOT_YET_ANSWERED' });
              return;
            }
            onChange({ state: 'ANSWERED', value: Number(event.target.value) });
          }}
          step={step}
          type="number"
          value={value.state === 'ANSWERED' ? String(value.value) : ''}
        />
      </label>
      {helpText ? (
        <p className="m-0 text-sm text-muted-foreground">{helpText}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {missingStates.map(([state, stateLabel]) => (
          <Button
            className="min-h-9 px-3 text-xs"
            key={state}
            onClick={() => onChange({ state })}
            type="button"
            variant={value.state === state ? 'secondary' : 'ghost'}
          >
            {stateLabel}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function BooleanChoice({
  label,
  value,
  onChange,
  helpText,
  disabled = false,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  helpText?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-3 rounded-lg border p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {helpText ? (
        <p className="m-0 text-sm text-muted-foreground">{helpText}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          [true, 'Yes'],
          [false, 'No'],
        ].map(([choice, choiceLabel]) => (
          <Button
            className="justify-start"
            key={String(choice)}
            onClick={() => onChange(choice as boolean)}
            type="button"
            variant={value === choice ? 'primary' : 'outline'}
          >
            {choiceLabel}
          </Button>
        ))}
      </div>
      {value === undefined ? (
        <p className="m-0 text-xs text-muted-foreground">
          Choose yes or no to continue.
        </p>
      ) : null}
    </fieldset>
  );
}

export function TriStateChoice({
  label,
  value,
  onChange,
  helpText,
}: {
  label: string;
  value: 'YES' | 'NO' | 'UNSURE' | undefined;
  onChange: (value: 'YES' | 'NO' | 'UNSURE') => void;
  helpText?: string;
}) {
  return (
    <fieldset className="grid gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {helpText ? (
        <p className="m-0 text-sm text-muted-foreground">{helpText}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-3">
        {(['YES', 'NO', 'UNSURE'] as const).map((choice) => (
          <Button
            className="justify-start"
            key={choice}
            onClick={() => onChange(choice)}
            type="button"
            variant={value === choice ? 'primary' : 'outline'}
          >
            {choice.charAt(0) + choice.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
