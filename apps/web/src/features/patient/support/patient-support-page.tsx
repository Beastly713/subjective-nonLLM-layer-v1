import {
  ContentFeedbackOutcomeSchema,
  ContentFeedbackResponseSchema,
  ContentRestoreResponseSchema,
  PatientSupportResponseSchema,
  type ContentFeedbackOutcome,
  type ContentResourceView,
  type PatientSupportResponse,
} from '@aud-subjective/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Compass, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { PatientSafetyBoundary } from '@/features/patient/safety/patient-safety-boundary';
import { PatientShell } from '@/app/shells/patient-shell';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  RestrictedState,
} from '@/components/patterns/system-state';
import { PageHeader } from '@/components/patterns/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ApiClientError, apiMutate } from '@/lib/api/client';
import { usePatientSupport } from './use-patient-support';
import { SupportResourceCard } from './support-resource-card';

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

export function PatientSupportPage() {
  return (
    <PatientSafetyBoundary>
      <PatientSupportContent />
    </PatientSafetyBoundary>
  );
}

function PatientSupportContent() {
  const query = usePatientSupport();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string>();

  const mutation = useMutation({
    mutationFn: async (input: {
      resource: ContentResourceView;
      outcome: ContentFeedbackOutcome;
    }) =>
      apiMutate(
        `/api/v1/patient/support/resources/${input.resource.resourceId}/feedback` as `/api/v1/${string}`,
        'POST',
        {
          resourceVersionId: input.resource.resourceVersionId,
          resolutionId: input.resource.resolutionId,
          outcome: ContentFeedbackOutcomeSchema.parse(input.outcome),
        },
        {
          schema: ContentFeedbackResponseSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      ),
    onSuccess: (_value, input) => {
      if (input.outcome === 'DISMISS') {
        setDismissed((previous) => new Set(previous).add(input.resource.resourceId));
      }
      setMessage(
        input.outcome === 'DONT_SHOW_THIS_TYPE'
          ? 'That support type is hidden until you restore it below.'
          : 'Your preference was saved.',
      );
      void queryClient.invalidateQueries({ queryKey: ['patient', 'support'] });
    },
  });

  const explore = useMutation({
    mutationFn: (interventionClass: PatientSupportResponse['exploreOptions'][number]['key']) =>
      apiMutate<PatientSupportResponse>(
        '/api/v1/patient/support/explore',
        'POST',
        { interventionClass },
        {
          schema: PatientSupportResponseSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      ),
    onSuccess: (response) => {
      queryClient.setQueryData(['patient', 'support'], response);
      setMessage('Support loaded.');
    },
    onError: () => setMessage('Support could not be loaded. Try again.'),
  });

  const restore = useMutation({
    mutationFn: (interventionClass: PatientSupportResponse['hiddenInterventionClasses'][number]['key']) =>
      apiMutate(
        `/api/v1/patient/support/intervention-classes/${interventionClass}/restore` as `/api/v1/${string}`,
        'POST',
        {},
        {
          schema: ContentRestoreResponseSchema,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      ),
    onSuccess: () => {
      setMessage('That support type is available again.');
      void queryClient.invalidateQueries({ queryKey: ['patient', 'support'] });
    },
    onError: () => setMessage('That support type could not be restored. Try again.'),
  });

  const feedback = async (resource: ContentResourceView, outcome: ContentFeedbackOutcome) => {
    setMessage(undefined);
    try {
      await mutation.mutateAsync({ resource, outcome });
    } catch (error) {
      setMessage('Your preference could not be saved. Try again.');
      throw error;
    }
  };

  if (query.isLoading) {
    return <PatientShell><LoadingState /></PatientShell>;
  }
  if (query.isError || !query.data) {
    if (query.error instanceof ApiClientError && query.error.status === 403) {
      return <PatientShell><RestrictedState /></PatientShell>;
    }
    return <PatientShell><ErrorState action={<Button onClick={() => void query.refetch()}>Try again</Button>} /></PatientShell>;
  }

  const support = query.data;
  const resources = [support.primary, support.secondary].filter(
    (resource): resource is ContentResourceView => Boolean(resource),
  );
  const visibleResources = resources.filter(
    (resource) => !dismissed.has(resource.resourceId),
  );

  return (
    <PatientShell>
      <div className="grid gap-8">
        <PageHeader
          description="Practical, optional support selected from your current monitoring context. You choose what feels useful."
          eyebrow="Patient support"
          title="Support for this week"
        />

        {message ? <p className="m-0 text-sm font-semibold text-success" role="status">{message}</p> : null}

        {support.source ? (
          <p className="m-0 text-sm text-muted-foreground">
            Based on your {support.source.completionStatus === 'PARTIAL' ? 'partial ' : ''}check-in submitted {formatDate(support.source.submittedAt)}.
          </p>
        ) : null}

        {support.status === 'CONTENT_UNAVAILABLE' ? (
          <Card className="border-border-strong">
            <CardContent className="p-6">
              <h2 className="m-0 text-xl font-semibold">Support is not available right now</h2>
              <p className="mb-0 mt-3 text-sm leading-6 text-muted-foreground">
                No support resource currently meets the requirements for this check-in. Your monitoring record is still preserved.
              </p>
            </CardContent>
          </Card>
        ) : support.status === 'NO_CURRENT_SUPPORT' ? (
          <EmptyState />
        ) : visibleResources.length === 0 && support.availableFollowup.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5">
            {visibleResources.map((resource, index) => (
              <SupportResourceCard
                eyebrow={index === 0 ? 'Suggested first' : 'Another option'}
                key={resource.resourceId}
                onFeedback={feedback}
                resource={resource}
              />
            ))}
            {support.availableFollowup.map((resource) => (
              <SupportResourceCard
                eyebrow="Available if you want to explore"
                key={resource.resourceId}
                onFeedback={feedback}
                resource={resource}
              />
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Compass aria-hidden="true" className="size-5 text-primary" />
              <div>
                <h2 className="m-0 text-xl font-semibold">Explore another support type</h2>
                <p className="mb-0 mt-1 text-sm text-muted-foreground">Explore is a request, not an automatic recommendation.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {support.exploreOptions.filter((option) => !support.hiddenInterventionClasses.some((hidden) => hidden.key === option.key)).map((option) => (
                <Button
                  disabled={explore.isPending}
                  key={option.key}
                  onClick={() => explore.mutate(option.key)}
                  variant="outline"
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {support.hiddenInterventionClasses.length > 0 ? (
              <div className="grid gap-3 border-t pt-4">
                <p className="m-0 text-sm font-semibold">Hidden support types</p>
                {support.hiddenInterventionClasses.map((option) => (
                  <div className="flex flex-wrap items-center justify-between gap-3" key={option.key}>
                    <span className="text-sm text-muted-foreground">{option.label}</span>
                    <Button disabled={restore.isPending} onClick={() => restore.mutate(option.key)} size="compact" variant="ghost">
                      <RotateCcw aria-hidden="true" className="size-4" />
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PatientShell>
  );
}
