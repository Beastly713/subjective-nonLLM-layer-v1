import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NumericResponseField } from '../onboarding-response-controls';
import type { OnboardingStepProps } from '../types';

const lastDrinkOptions = [
  { value: 'KNOWN' as const, label: 'I know the date' },
  { value: 'APPROXIMATE' as const, label: 'I know approximately' },
  { value: 'UNKNOWN' as const, label: 'I do not know' },
  { value: 'PREFER_NOT_TO_SAY' as const, label: 'Prefer not to say' },
];

export function DrinkingContextStep({
  draft,
  updateDraft,
}: OnboardingStepProps) {
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-sm font-semibold text-primary">
          Drinking context
        </p>
        <h2 className="m-0 mt-1 text-2xl font-semibold">
          Add a little more context
        </h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          Approximate answers are welcome. These responses help the next safety
          step understand timing without creating a reduction baseline.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <NumericResponseField
          helpText="Use a whole number from 0 through 7."
          label="On how many days per week do you usually drink?"
          max={7}
          min={0}
          onChange={(value) => updateDraft('drinkingDaysPerWeek', value)}
          value={draft.drinkingDaysPerWeek}
        />
        <NumericResponseField
          helpText="Zero is a valid answer when you do not drink on a typical drinking day."
          label="How many drinks do you usually have on a drinking day?"
          min={0}
          onChange={(value) => updateDraft('drinksPerDrinkingDay', value)}
          step={0.5}
          value={draft.drinksPerDrinkingDay}
        />
        <NumericResponseField
          helpText="Count recent days, not a 28-day baseline."
          label="How many recent days involved heavy drinking?"
          min={0}
          onChange={(value) => updateDraft('heavyDrinkingDaysRecent', value)}
          value={draft.heavyDrinkingDaysRecent}
        />
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">
            When was your last drink?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {lastDrinkOptions.map((option) => (
              <Button
                className="justify-start text-left"
                key={option.value}
                onClick={() =>
                  updateDraft(
                    'lastDrink',
                    option.value === 'KNOWN' || option.value === 'APPROXIMATE'
                      ? draft.lastDrink.date
                        ? { state: option.value, date: draft.lastDrink.date }
                        : { state: option.value }
                      : { state: option.value },
                  )
                }
                type="button"
                variant={
                  draft.lastDrink.state === option.value ? 'primary' : 'outline'
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </fieldset>
        {draft.lastDrink.state === 'KNOWN' ||
        draft.lastDrink.state === 'APPROXIMATE' ? (
          <label className="grid gap-2 text-sm font-semibold">
            {draft.lastDrink.state === 'KNOWN'
              ? 'Date of last drink'
              : 'Approximate date (optional)'}
            <Input
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) =>
                updateDraft(
                  'lastDrink',
                  event.target.value
                    ? { ...draft.lastDrink, date: event.target.value }
                    : { state: draft.lastDrink.state },
                )
              }
              type="date"
              value={draft.lastDrink.date ?? ''}
            />
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}
