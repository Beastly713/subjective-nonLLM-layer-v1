import {
  ActionResultSchema,
  AdminUserDetailResponseSchema,
  AdminUserListResponseSchema,
  AdminUserResponseSchema,
  type AdminUserDetailResponse,
  type AdminUserListResponse,
} from '@aud-subjective/contracts';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { AdminShell } from '@/app/shells/admin-shell';
import { WorkspaceBoundary } from '@/app/shells/workspace-boundary';
import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import { ErrorState, LoadingState } from '@/components/patterns/system-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCurrentSession } from '@/features/auth/use-auth-data';
import { apiGet, apiMutate } from '@/lib/api/client';

type ProvisionFields = {
  name: string;
  email: string;
  initialPassword: string;
  role: 'PATIENT' | 'CLINICIAN' | 'ADMIN' | 'OPERATIONS';
  monitoringTimezone: string;
};

const roleWorkspace = {
  PATIENT: 'PATIENT',
  CLINICIAN: 'CLINICIAN',
  ADMIN: 'ADMIN',
  OPERATIONS: 'ADMIN',
} as const;

function hasPermission(permissions: readonly string[], permission: string) {
  return permissions.includes(permission);
}

export function AdminUsersPage() {
  const session = useCurrentSession();
  const permissions = session.data?.authenticated
    ? session.data.session.access.permissions
    : [];
  const canProvision = hasPermission(permissions, 'USER_PROVISION');
  const canManageState = hasPermission(permissions, 'USER_STATE_MANAGE');
  const canManageRoles = hasPermission(permissions, 'ROLE_MANAGE');
  const canVerifyIdentity = hasPermission(
    permissions,
    'PRIVILEGED_IDENTITY_VERIFY',
  );
  const canManageAssignments = hasPermission(
    permissions,
    'PATIENT_ASSIGNMENT_MANAGE',
  );
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>();
  const [roleToGrant, setRoleToGrant] =
    useState<keyof typeof roleWorkspace>('PATIENT');
  const [patientToAssign, setPatientToAssign] = useState('');
  const [verificationReference, setVerificationReference] = useState('');
  const { register, handleSubmit, reset, control, formState } =
    useForm<ProvisionFields>({
      defaultValues: { role: 'PATIENT', monitoringTimezone: 'UTC' },
    });
  const selectedRole = useWatch({ control, name: 'role' });
  const users = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: ({ signal }) =>
      apiGet<AdminUserListResponse>(
        `/api/v1/admin/users?search=${encodeURIComponent(search)}&pageSize=100`,
        { schema: AdminUserListResponseSchema, signal },
      ),
  });
  const detail = useQuery({
    queryKey: ['admin', 'user', selectedUserId],
    enabled: Boolean(selectedUserId),
    queryFn: ({ signal }) =>
      apiGet<AdminUserDetailResponse>(`/api/v1/admin/users/${selectedUserId}`, {
        schema: AdminUserDetailResponseSchema,
        signal,
      }),
  });

  const refresh = async () => {
    await users.refetch();
    if (selectedUserId) await detail.refetch();
  };
  const provision = handleSubmit(async (values) => {
    await apiMutate(
      '/api/v1/admin/users',
      'POST',
      {
        name: values.name,
        email: values.email,
        initialPassword: values.initialPassword,
        role: values.role,
        workspace: roleWorkspace[values.role],
        ...(values.role === 'PATIENT'
          ? { monitoringTimezone: values.monitoringTimezone }
          : {}),
        reason: 'Administrator provisioned account',
      },
      {
        schema: AdminUserResponseSchema,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      },
    );
    reset();
    setFormOpen(false);
    await users.refetch();
  });
  const mutate = async (path: `/api/v1/${string}`, payload: unknown) => {
    await apiMutate(path, 'POST', payload, {
      schema: ActionResultSchema,
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    await refresh();
  };
  const selected = detail.data;
  const patientCandidates =
    users.data?.items.filter((user) =>
      user.roles.some(({ role }) => role === 'PATIENT'),
    ) ?? [];

  return (
    <WorkspaceBoundary workspace="ADMIN">
      <AdminShell permissions={permissions}>
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="m-0 text-sm font-semibold text-primary">
              Operational identity controls
            </p>
            <h1 className="mb-0 mt-1 text-3xl font-semibold">
              Users &amp; Access
            </h1>
            <p className="mb-0 mt-2 text-sm text-muted-foreground">
              Account state, role grants, verification, and direct assignments.
            </p>
          </div>
          {canProvision ? (
            <Button onClick={() => setFormOpen((value) => !value)}>
              <UserPlus className="size-4" />
              Provision account
            </Button>
          ) : null}
        </div>

        {canProvision && formOpen ? (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="m-0 text-lg font-semibold">New account</h2>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={provision}>
                <label className="grid gap-2 text-sm font-medium">
                  Name
                  <Input required {...register('name')} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Email
                  <Input type="email" required {...register('email')} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Initial password
                  <Input
                    type="password"
                    minLength={8}
                    required
                    {...register('initialPassword')}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Role
                  <select
                    className="h-11 rounded-md border bg-surface px-3"
                    {...register('role')}
                  >
                    <option>PATIENT</option>
                    <option>CLINICIAN</option>
                    <option>ADMIN</option>
                    <option>OPERATIONS</option>
                  </select>
                </label>
                {selectedRole === 'PATIENT' ? (
                  <label className="grid gap-2 text-sm font-medium">
                    Monitoring timezone
                    <Input required {...register('monitoringTimezone')} />
                  </label>
                ) : null}
                <div className="flex items-end">
                  <Button type="submit" disabled={formState.isSubmitting}>
                    {formState.isSubmitting
                      ? 'Provisioning…'
                      : 'Create pending account'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-4 flex items-center gap-3">
          <label className="relative block w-full max-w-sm">
            <span className="sr-only">Search users</span>
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <span className="text-sm text-muted-foreground">
            {users.data?.total ?? 0} users
          </span>
        </div>
        {users.isLoading ? (
          <LoadingState />
        ) : users.isError ? (
          <ErrorState />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-surface-interactive text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Identity</th>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Access</th>
                      <th className="px-4 py-3">Assurance</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data?.items.map((user) => (
                      <tr className="border-t align-top" key={user.userId}>
                        <td className="px-4 py-4">
                          <p className="m-0 font-semibold">{user.name}</p>
                          <p className="m-0 text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </td>
                        <td className="px-4 py-4">{user.accountState}</td>
                        <td className="px-4 py-4">
                          <p className="m-0">
                            {user.roles.map(({ role }) => role).join(', ') ||
                              'No role'}
                          </p>
                          <p className="m-0 text-xs text-muted-foreground">
                            {user.activePatientAssignments} patient assignments
                          </p>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          <p className="m-0">
                            Email: {user.emailVerified ? 'verified' : 'pending'}
                          </p>
                          <p className="m-0">
                            MFA: {user.mfaEnabled ? 'enabled' : 'not enabled'}
                          </p>
                          <p className="m-0">
                            Identity: {user.privilegedIdentityStatus}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setSelectedUserId(user.userId)}
                            >
                              View access
                            </Button>
                            {canManageState ? (
                              <ConfirmActionDialog
                                triggerLabel={
                                  user.accountState === 'ACTIVE'
                                    ? 'Disable'
                                    : 'Enable'
                                }
                                title={`${user.accountState === 'ACTIVE' ? 'Disable' : 'Enable'} ${user.name}?`}
                                description="This changes application access and revokes the account's active sessions."
                                confirmLabel="Confirm change"
                                intent={
                                  user.accountState === 'ACTIVE'
                                    ? 'destructive'
                                    : 'normal'
                                }
                                onConfirm={() =>
                                  mutate(
                                    `/api/v1/admin/users/${user.userId}/${user.accountState === 'ACTIVE' ? 'disable' : 'enable'}`,
                                    {
                                      expectedVersion: user.accountVersion,
                                      reason:
                                        'Administrator changed account state',
                                    },
                                  )
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedUserId ? (
          <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l bg-surface p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Access detail
                </p>
                <h2 className="mb-0 mt-1 text-2xl font-semibold">
                  {selected?.name ?? 'Loading account…'}
                </h2>
              </div>
              <Button
                aria-label="Close access detail"
                variant="outline"
                onClick={() => setSelectedUserId(undefined)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {detail.isLoading ? (
              <LoadingState />
            ) : detail.isError || !selected ? (
              <ErrorState
                action={
                  <Button onClick={() => void detail.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : (
              <AccessDetail
                canManageAssignments={canManageAssignments}
                canManageRoles={canManageRoles}
                canVerifyIdentity={canVerifyIdentity}
                patientCandidates={patientCandidates}
                patientToAssign={patientToAssign}
                roleToGrant={roleToGrant}
                selected={selected}
                verificationReference={verificationReference}
                onPatientChange={setPatientToAssign}
                onRoleChange={setRoleToGrant}
                onVerificationReferenceChange={setVerificationReference}
                mutate={mutate}
              />
            )}
          </aside>
        ) : null}
      </AdminShell>
    </WorkspaceBoundary>
  );
}

function AccessDetail({
  selected,
  canManageRoles,
  canVerifyIdentity,
  canManageAssignments,
  roleToGrant,
  patientToAssign,
  verificationReference,
  patientCandidates,
  onRoleChange,
  onPatientChange,
  onVerificationReferenceChange,
  mutate,
}: {
  selected: AdminUserDetailResponse;
  canManageRoles: boolean;
  canVerifyIdentity: boolean;
  canManageAssignments: boolean;
  roleToGrant: keyof typeof roleWorkspace;
  patientToAssign: string;
  verificationReference: string;
  patientCandidates: AdminUserListResponse['items'];
  onRoleChange: (role: keyof typeof roleWorkspace) => void;
  onPatientChange: (patientId: string) => void;
  onVerificationReferenceChange: (reference: string) => void;
  mutate: (path: `/api/v1/${string}`, payload: unknown) => Promise<void>;
}) {
  const isClinician = selected.roles.some(({ role }) => role === 'CLINICIAN');
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <h3 className="m-0 text-lg font-semibold">Active roles</h3>
        </CardHeader>
        <CardContent className="grid gap-3">
          {selected.roles.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">No active role.</p>
          ) : (
            selected.roles.map((assignment) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border p-3"
                key={assignment.id}
              >
                <span className="text-sm font-semibold">
                  {assignment.role} · {assignment.workspace}
                </span>
                {canManageRoles ? (
                  <ConfirmActionDialog
                    triggerLabel="Revoke"
                    title={`Revoke ${assignment.role}?`}
                    description="This revokes the role and the user's active sessions."
                    confirmLabel="Revoke role"
                    intent="destructive"
                    onConfirm={() =>
                      mutate(
                        `/api/v1/admin/users/${selected.userId}/roles/${assignment.id}/revoke`,
                        {
                          expectedVersion: assignment.version,
                          reason: 'Administrator revoked role',
                        },
                      )
                    }
                  />
                ) : null}
              </div>
            ))
          )}
          {canManageRoles ? (
            <div className="grid gap-2 rounded-md bg-surface-subtle p-3 sm:grid-cols-[1fr_auto]">
              <label className="grid gap-1 text-sm font-medium">
                Role to grant
                <select
                  className="h-11 rounded-md border bg-surface px-3"
                  value={roleToGrant}
                  onChange={(event) =>
                    onRoleChange(
                      event.target.value as keyof typeof roleWorkspace,
                    )
                  }
                >
                  {Object.keys(roleWorkspace).map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <ConfirmActionDialog
                  triggerLabel="Grant role"
                  title={`Grant ${roleToGrant}?`}
                  description="The backend validates the role/workspace pair and patient-profile prerequisites."
                  confirmLabel="Grant role"
                  onConfirm={() =>
                    mutate(`/api/v1/admin/users/${selected.userId}/roles`, {
                      role: roleToGrant,
                      workspace: roleWorkspace[roleToGrant],
                      reason: 'Administrator granted role',
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selected.privilegedIdentityStatus !== 'NOT_REQUIRED' ? (
        <Card>
          <CardHeader>
            <h3 className="m-0 text-lg font-semibold">Privileged identity</h3>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="m-0 text-sm">
              Status: {selected.privilegedIdentityStatus}
            </p>
            {canVerifyIdentity &&
            selected.privilegedIdentityStatus === 'PENDING' ? (
              <>
                <label className="grid gap-1 text-sm font-medium">
                  Verification reference
                  <Input
                    value={verificationReference}
                    onChange={(event) =>
                      onVerificationReferenceChange(event.target.value)
                    }
                  />
                </label>
                <ConfirmActionDialog
                  triggerLabel="Record verification"
                  title={`Verify ${selected.name}'s identity?`}
                  description="Record the reviewed identity provenance and revoke active sessions."
                  confirmLabel="Record verification"
                  disabled={!verificationReference.trim()}
                  onConfirm={() =>
                    mutate(
                      `/api/v1/admin/users/${selected.userId}/verify-identity`,
                      {
                        expectedVersion: selected.accountVersion,
                        verificationReference: verificationReference.trim(),
                      },
                    )
                  }
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {selected.directAssignments.length > 0 ||
      (canManageAssignments && isClinician) ? (
        <Card>
          <CardHeader>
            <h3 className="m-0 text-lg font-semibold">Direct assignments</h3>
          </CardHeader>
          <CardContent className="grid gap-3">
            {selected.directAssignments.map((assignment) => (
              <div className="rounded-md border p-3" key={assignment.id}>
                <p className="m-0 text-sm font-semibold">
                  {assignment.clinician.name} → {assignment.patient.name}
                </p>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  {assignment.patient.email}
                </p>
                {canManageAssignments ? (
                  <ConfirmActionDialog
                    triggerLabel="End assignment"
                    title="End this direct assignment?"
                    description="The clinician's sessions are revoked when assignment scope changes."
                    confirmLabel="End assignment"
                    intent="destructive"
                    onConfirm={() =>
                      mutate(
                        `/api/v1/admin/patient-assignments/${assignment.id}/end`,
                        {
                          expectedVersion: assignment.version,
                          reason: 'Administrator ended assignment',
                        },
                      )
                    }
                  />
                ) : null}
              </div>
            ))}
            {canManageAssignments && isClinician ? (
              <div className="grid gap-2 rounded-md bg-surface-subtle p-3 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-1 text-sm font-medium">
                  Assign patient
                  <select
                    className="h-11 rounded-md border bg-surface px-3"
                    value={patientToAssign}
                    onChange={(event) => onPatientChange(event.target.value)}
                  >
                    <option value="">Select patient</option>
                    {patientCandidates.map((patient) => (
                      <option key={patient.userId} value={patient.userId}>
                        {patient.name} · {patient.email}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <ConfirmActionDialog
                    triggerLabel="Assign patient"
                    title="Create this direct assignment?"
                    description="Only this clinician receives direct access to the selected patient."
                    confirmLabel="Create assignment"
                    disabled={!patientToAssign}
                    onConfirm={() =>
                      mutate('/api/v1/admin/patient-assignments', {
                        clinicianUserId: selected.userId,
                        patientId: patientToAssign,
                        reason: 'Administrator created direct assignment',
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
