import type { ReductionSetupResponse } from '@aud-subjective/contracts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ReductionTargetCard({
  baseline,
  proposal,
  value,
  disabled,
  pending,
  onChange,
  onSubmit,
}: {
  baseline: NonNullable<
    ReductionSetupResponse['authoritativeBaseline']
  >;
  proposal: ReductionSetupResponse['proposal'];
  value: string;
  disabled: boolean;
  pending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-semibold">Reduction target proposal</h2>
            <p className="mb-0 mt-1 text-sm text-muted-foreground">
              A positive target must be below the baseline weekly average of{' '}
              {baseline.metrics.baselineAverageWeeklyDrinks} drinks. Enter 0 to
              propose abstinence.
            </p>
          </div>
          {proposal ? <Badge variant="information">PROPOSED</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {proposal ? (
          <div className="rounded-lg border border-information-border bg-information-surface p-4 text-sm">
            <p className="m-0 font-semibold">
              {proposal.kind === 'ABSTINENCE'
                ? 'Abstinence proposal saved'
                : 'Target proposal saved'}
            </p>
            <p className="mb-0 mt-2 text-muted-foreground">
              This proposal is not active yet. Final safety-gated setup happens
              in the next setup stage.
            </p>
          </div>
        ) : null}
        {disabled ? (
          <p className="m-0 rounded-lg border border-warning-border bg-warning-surface p-3 text-sm text-warning">
            Target changes are unavailable during the current safety review.
          </p>
        ) : null}
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="targetWeeklyStandardDrinks">
              Target drinks per week
            </Label>
            <Input
              disabled={disabled || pending}
              id="targetWeeklyStandardDrinks"
              min="0"
              onChange={(event) => onChange(event.target.value)}
              placeholder="e.g. 6.0"
              step="0.1"
              type="number"
              value={value}
            />
          </div>
          <Button disabled={disabled || pending || value === ''} type="submit">
            Save proposal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
