import { useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { PatientShell } from '@/app/shells/patient-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { apiGet, apiMutate } from '@/lib/api/client';

const response = (value?: unknown) =>
  value === undefined ? { state: 'NOT_YET_ANSWERED' } : { state: 'ANSWERED', value };
const initialDraft = {
  auditC: { frequency: response(), quantity: response(), heavy: response() },
  drinkingDaysPerWeek: response(),
  drinksPerDrinkingDay: response(),
  heavyDrinkingDaysRecent: response(),
  lastDrink: { state: 'UNKNOWN' },
  recoveryDirection: response('UNSURE'),
  mutualHelpPreference: response('UNSURE'),
  spiritualContentPreference: response('UNSURE'),
};
const OnboardingResponse = z.object({
  draft: z.unknown().nullable(),
  currentStep: z.string(),
  version: z.number(),
  dependencyState: z.string(),
});

export function PatientOnboardingPage() {
  const query = useQuery({
    queryKey: ['patient', 'onboarding'],
    queryFn: ({ signal }) =>
      apiGet('/api/v1/patient/onboarding', { schema: OnboardingResponse, signal }),
  });
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState('ACCOUNT');
  const [saving, setSaving] = useState(false);
  const data = query.data;
  if (query.isLoading) return <PatientShell><p>Loading setup...</p></PatientShell>;
  if (query.isError || !data) return <PatientShell><p>Setup could not be loaded. Please try again.</p></PatientShell>;
  const current = draft ?? (data.draft as Record<string, unknown> | null) ?? (initialDraft as Record<string, unknown>);
  const safetyDraft = (current.safetyDraft as { responses?: Record<string, unknown> } | undefined)?.responses ?? {};
  async function save(nextStep = step, nextDraft = current) {
    setSaving(true);
    try {
      const result = await apiMutate(
        '/api/v1/patient/onboarding/draft',
        'PUT',
        { expectedVersion: data!.version, currentStep: nextStep, draftResponses: nextDraft },
        { schema: z.object({ version: z.number(), currentStep: z.string(), draft: z.unknown() }) },
      );
      setDraft(result.draft as Record<string, unknown>);
      setStep(nextStep);
      await query.refetch();
    } finally {
      setSaving(false);
    }
  }
  function updateSafetyDraft(key: string, value: unknown) {
    setDraft({
      ...current,
      safetyDraft: {
        schemaVersion: 'safety_draft_v1',
        updatedAt: new Date().toISOString(),
        responses: { ...safetyDraft, [key]: value },
      },
    });
  }
  return (
    <WorkspaceBoundary destination="/patient/onboarding">
      <PatientShell>
        <div className="mb-8">
          <p className="text-sm font-semibold text-success">Setup incomplete</p>
          <h1 className="mt-2 text-3xl font-semibold">Set up your support plan</h1>
          <p className="text-muted-foreground">Your progress is saved securely so you can return later.</p>
        </div>
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <p className="m-0 text-sm font-semibold">Step: {step}</p>
              <h2 className="m-0 text-xl">Account and preferences</h2>
            </CardHeader>
            <CardContent className="grid gap-5">
              <label className="grid gap-2 text-sm font-medium">
                Recovery direction
                <select className="h-11 rounded-md border bg-surface px-3" value={(current.recoveryDirection as { value?: string })?.value ?? 'UNSURE'} onChange={(event) => setDraft({ ...current, recoveryDirection: response(event.target.value) })}>
                  <option value="UNSURE">I am not sure yet</option>
                  <option value="ABSTINENCE">Abstinence</option>
                  <option value="REDUCTION">Reduction</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={saving} onClick={() => void save('SAFETY')}>
                  <Save className="size-4" /> {saving ? 'Saving...' : 'Save and continue'}
                </Button>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => void save(step)}>Save progress</Button>
              </div>
            </CardContent>
          </Card>
          {step === 'SAFETY' ? (
            <Card>
              <CardHeader>
                <p className="m-0 text-sm font-semibold text-warning">Instrument configuration unavailable</p>
                <h2 className="m-0 text-xl">Safety check draft</h2>
              </CardHeader>
              <CardContent className="grid gap-5">
                <label className="grid gap-2 text-sm font-medium">
                  Age over 65
                  <select className="h-11 rounded-md border bg-surface px-3" value={(safetyDraft.ageOver65 as string | undefined) ?? 'UNSURE'} onChange={(event) => updateSafetyDraft('ageOver65', event.target.value)}>
                    <option value="UNSURE">Unsure</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Similar heavy regular use for at least 3 months
                  <select className="h-11 rounded-md border bg-surface px-3" value={(safetyDraft.similarHeavyRegularUseAtLeast3Months as string | undefined) ?? 'UNSURE'} onChange={(event) => updateSafetyDraft('similarHeavyRegularUseAtLeast3Months', event.target.value)}>
                    <option value="UNSURE">Unsure</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                  </select>
                </label>
                <p className="m-0 text-sm text-muted-foreground">The licensed screener wording is not configured for this deployment, so this step can be saved but not completed here.</p>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => void save('SAFETY')}>
                  <Save className="size-4" /> Save safety draft
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </PatientShell>
    </WorkspaceBoundary>
  );
}
