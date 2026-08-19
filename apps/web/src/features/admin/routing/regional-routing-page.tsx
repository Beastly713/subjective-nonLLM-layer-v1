import {
  RoutingProfileDetailSchema,
  RoutingProfileListSchema,
  type RoutingProfileDetail,
  type RoutingProfileList,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { AdminShell } from '@/app/shells/admin-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { apiGet, apiMutate } from '@/lib/api/client';

const targetKinds = [
  'EMERGENCY_SERVICE',
  'CRISIS_SERVICE',
  'URGENT_MEDICAL_SERVICE',
  'ON_CALL_CLINICIAN_QUEUE',
] as const;

export function RegionalRoutingPage() {
  const session = useCurrentSession();
  const permissions = session.data?.authenticated
    ? session.data.session.access.permissions
    : [];
  const canEdit = permissions.includes('ROUTING_CONFIG_EDIT');
  const canTest = permissions.includes('ROUTING_TEST_RECORD');
  const canActivate = permissions.includes('ROUTING_CONFIG_ACTIVATE');
  const [selectedId, setSelectedId] = useState<string>();
  const [countryCode, setCountryCode] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const profiles = useQuery({
    queryKey: ['routing', 'profiles'],
    queryFn: ({ signal }) =>
      apiGet<RoutingProfileList>(
        '/api/v1/admin/configuration/regional-routing',
        { schema: RoutingProfileListSchema, signal },
      ),
  });
  const detail = useQuery({
    queryKey: ['routing', 'profile', selectedId],
    enabled: Boolean(selectedId),
    queryFn: ({ signal }) =>
      apiGet<RoutingProfileDetail>(
        `/api/v1/admin/configuration/regional-routing/${selectedId}`,
        { schema: RoutingProfileDetailSchema, signal },
      ),
  });
  const mutate = async (path: `/api/v1/${string}`, body: unknown) => {
    const result = await apiMutate<RoutingProfileDetail>(path, 'POST', body, {
      schema: RoutingProfileDetailSchema,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    setSelectedId(result.id);
    await Promise.all([profiles.refetch(), detail.refetch()]);
  };
  const createDraft = async () => {
    await mutate('/api/v1/admin/configuration/regional-routing/drafts', {
      countryCode,
      regionCode: regionCode.trim() || null,
      reason: 'Administrator created routing draft',
    });
    setCountryCode('');
    setRegionCode('');
  };

  return (
    <WorkspaceBoundary workspace="ADMIN">
      <AdminShell permissions={permissions}>
        <div className="mb-6">
          <p className="m-0 text-sm font-semibold text-primary">
            Deployment configuration
          </p>
          <h1 className="mb-0 mt-1 text-3xl font-semibold">Regional Routing</h1>
          <p className="mb-0 mt-2 text-sm text-muted-foreground">
            Versioned regional targets must be tested exactly as configured
            before activation.
          </p>
        </div>
        {canEdit ? (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="m-0 text-lg font-semibold">
                Create next draft version
              </h2>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-1 text-sm font-medium">
                Country code
                <Input
                  maxLength={2}
                  value={countryCode}
                  onChange={(event) =>
                    setCountryCode(event.target.value.toUpperCase())
                  }
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Region code (optional)
                <Input
                  value={regionCode}
                  onChange={(event) =>
                    setRegionCode(event.target.value.toUpperCase())
                  }
                />
              </label>
              <div className="flex items-end">
                <ConfirmActionDialog
                  triggerLabel="Create draft"
                  title="Create a new routing draft?"
                  description="The new version begins as an inactive draft with no assumed emergency fallback."
                  confirmLabel="Create draft"
                  disabled={!/^[A-Z]{2}$/.test(countryCode)}
                  onConfirm={createDraft}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.5fr)]">
          <section>
            {profiles.isLoading ? (
              <LoadingState />
            ) : profiles.isError ? (
              <ErrorState
                action={
                  <Button onClick={() => void profiles.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : profiles.data?.items.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-3">
                {profiles.data?.items.map((profile) => (
                  <button
                    className="rounded-lg border bg-surface p-4 text-left"
                    key={profile.id}
                    onClick={() => setSelectedId(profile.id)}
                    type="button"
                  >
                    <span className="font-semibold">
                      {profile.countryCode}
                      {profile.regionCode ? ` · ${profile.regionCode}` : ''}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      v{profile.logicalVersion} · {profile.lifecycle} · row{' '}
                      {profile.rowVersion}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            {!selectedId ? (
              <Card>
                <CardContent>
                  <p className="m-0 text-sm text-muted-foreground">
                    Choose a profile to review its exact targets and test
                    provenance.
                  </p>
                </CardContent>
              </Card>
            ) : detail.isLoading ? (
              <LoadingState />
            ) : detail.isError || !detail.data ? (
              <ErrorState
                action={
                  <Button onClick={() => void detail.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : (
              <RoutingDetail
                key={`${detail.data.id}:${detail.data.configurationRevision}:${detail.data.rowVersion}`}
                profile={detail.data}
                canActivate={canActivate}
                canEdit={canEdit}
                canTest={canTest}
                mutate={mutate}
              />
            )}
          </section>
        </div>
      </AdminShell>
    </WorkspaceBoundary>
  );
}

export function RoutingDetail({
  profile,
  canEdit,
  canTest,
  canActivate,
  mutate,
}: {
  profile: RoutingProfileDetail;
  canEdit: boolean;
  canTest: boolean;
  canActivate: boolean;
  mutate: (path: `/api/v1/${string}`, body: unknown) => Promise<void>;
}) {
  const initial = new Map(
    profile.targets.map((target) => [target.kind, target]),
  );
  const [targets, setTargets] = useState(() =>
    targetKinds.map(
      (kind) =>
        initial.get(kind) ?? {
          kind,
          representation:
            kind === 'ON_CALL_CLINICIAN_QUEUE'
              ? ('INTERNAL_QUEUE' as const)
              : ('TELEPHONE' as const),
          targetValue: '',
          label: '',
        },
    ),
  );
  const [evidenceReferences, setEvidenceReferences] = useState<
    Partial<Record<(typeof targetKinds)[number], string>>
  >({});
  const updateTarget = (
    kind: (typeof targetKinds)[number],
    field: 'representation' | 'targetValue' | 'label',
    value: string,
  ) =>
    setTargets((current) =>
      current.map((target) =>
        target.kind === kind ? { ...target, [field]: value } : target,
      ),
    );
  const currentEvidence = (kind: (typeof targetKinds)[number]) =>
    profile.testEvidence.find(
      (evidence) =>
        evidence.targetKind === kind &&
        evidence.configurationRevision === profile.configurationRevision,
    );
  const draft = profile.lifecycle === 'DRAFT';
  const hasUnsavedEdits = targets.some((target) => {
    const saved = initial.get(target.kind);
    return (
      !saved ||
      saved.representation !== target.representation ||
      saved.targetValue !== target.targetValue ||
      saved.label !== target.label
    );
  });
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-xl font-semibold">
              {profile.countryCode}
              {profile.regionCode ? ` · ${profile.regionCode}` : ''} v
              {profile.logicalVersion}
            </h2>
            <span className="rounded-full bg-surface-interactive px-3 py-1 text-xs font-semibold">
              {profile.lifecycle}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {targets.map((target) => (
            <fieldset
              className="grid gap-3 rounded-md border p-4"
              key={target.kind}
            >
              <legend className="px-1 text-sm font-semibold">
                {target.kind.replaceAll('_', ' ')}
              </legend>
              <label className="grid gap-1 text-sm">
                Representation
                <select
                  className="h-11 rounded-md border bg-surface px-3"
                  disabled={!draft || !canEdit}
                  value={target.representation}
                  onChange={(event) =>
                    updateTarget(
                      target.kind,
                      'representation',
                      event.target.value,
                    )
                  }
                >
                  <option>TELEPHONE</option>
                  <option>DEEP_LINK</option>
                  <option>INTERNAL_QUEUE</option>
                  <option>EXTERNAL_SERVICE</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Label
                <Input
                  disabled={!draft || !canEdit}
                  value={target.label}
                  onChange={(event) =>
                    updateTarget(target.kind, 'label', event.target.value)
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Deployment target
                <Input
                  disabled={!draft || !canEdit}
                  value={target.targetValue}
                  onChange={(event) =>
                    updateTarget(target.kind, 'targetValue', event.target.value)
                  }
                />
              </label>
              <p className="m-0 text-xs text-muted-foreground">
                Current evidence:{' '}
                {currentEvidence(target.kind)
                  ? `${currentEvidence(target.kind)!.result} · ${new Date(currentEvidence(target.kind)!.testedAt).toLocaleString()} · ${currentEvidence(target.kind)!.provenance}`
                  : 'Not tested for this configuration revision'}
              </p>
              <label className="grid gap-1 text-sm">
                Deployment test reference / evidence
                <Input
                  disabled={!draft || !canTest || hasUnsavedEdits}
                  value={evidenceReferences[target.kind] ?? ''}
                  onChange={(event) =>
                    setEvidenceReferences((current) => ({
                      ...current,
                      [target.kind]: event.target.value,
                    }))
                  }
                />
              </label>
              {draft &&
              canTest &&
              profile.targets.some(({ kind }) => kind === target.kind) ? (
                <div className="flex gap-2">
                  <ConfirmActionDialog
                    triggerLabel="Record PASS"
                    title={`Record successful test for ${target.kind}?`}
                    description="This records provenance supplied from a real deployment test; it does not contact an external provider."
                    confirmLabel="Record PASS"
                    disabled={
                      hasUnsavedEdits ||
                      !evidenceReferences[target.kind]?.trim()
                    }
                    onConfirm={() =>
                      mutate(
                        `/api/v1/admin/configuration/regional-routing/${profile.id}/test-evidence`,
                        {
                          expectedVersion: profile.rowVersion,
                          targetKind: target.kind,
                          result: 'PASS',
                          provenance: evidenceReferences[target.kind]!.trim(),
                        },
                      )
                    }
                  />
                  <ConfirmActionDialog
                    triggerLabel="Record FAIL"
                    title={`Record failed test for ${target.kind}?`}
                    description="The draft cannot activate until a later successful test is recorded for this exact configuration."
                    confirmLabel="Record FAIL"
                    disabled={
                      hasUnsavedEdits ||
                      !evidenceReferences[target.kind]?.trim()
                    }
                    onConfirm={() =>
                      mutate(
                        `/api/v1/admin/configuration/regional-routing/${profile.id}/test-evidence`,
                        {
                          expectedVersion: profile.rowVersion,
                          targetKind: target.kind,
                          result: 'FAIL',
                          provenance: evidenceReferences[target.kind]!.trim(),
                        },
                      )
                    }
                  />
                </div>
              ) : null}
            </fieldset>
          ))}
          {draft && canEdit ? (
            <ConfirmActionDialog
              triggerLabel="Save exact targets"
              title="Save this routing configuration?"
              description="Changing target content invalidates evidence recorded for an earlier configuration revision."
              confirmLabel="Save targets"
              disabled={targets.some(
                (target) => !target.label.trim() || !target.targetValue.trim(),
              )}
              onConfirm={() =>
                mutate(
                  `/api/v1/admin/configuration/regional-routing/${profile.id}/edit`,
                  {
                    expectedVersion: profile.rowVersion,
                    targets: targets.map(
                      ({ kind, representation, targetValue, label }) => ({
                        kind,
                        representation,
                        targetValue,
                        label,
                      }),
                    ),
                    reason: 'Administrator edited routing draft',
                  },
                )
              }
            />
          ) : null}
          {draft && canActivate ? (
            <ConfirmActionDialog
              triggerLabel="Activate tested version"
              title="Activate this tested routing version?"
              description="All four exact targets must have current PASS evidence. Any active version for this region becomes historical."
              confirmLabel="Activate version"
              disabled={
                hasUnsavedEdits ||
                targetKinds.some(
                  (kind) => currentEvidence(kind)?.result !== 'PASS',
                )
              }
              onConfirm={() =>
                mutate(
                  `/api/v1/admin/configuration/regional-routing/${profile.id}/activate`,
                  {
                    expectedVersion: profile.rowVersion,
                    reason: 'Administrator activated tested routing profile',
                  },
                )
              }
            />
          ) : null}
          {!draft ? (
            <p className="m-0 text-sm text-muted-foreground">
              {profile.lifecycle === 'ACTIVE'
                ? 'This configuration is active and read-only. Create a new draft version to make changes.'
                : 'This superseded configuration is historical and read-only.'}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
