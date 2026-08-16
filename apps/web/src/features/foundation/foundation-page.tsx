import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import { FormField } from '@/components/patterns/form-field';
import { PageHeader } from '@/components/patterns/page-header';
import { FreshnessBadge, StateBadge } from '@/components/patterns/state-badge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  RestrictedState,
  SafetyControlledState,
} from '@/components/patterns/system-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function SectionHeading({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 grid gap-2 border-b pb-5 sm:grid-cols-[5rem_1fr] sm:gap-5">
      <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary">
        {index}
      </p>
      <div>
        <h2 className="m-0 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
          {title}
        </h2>
        <p className="mb-0 mt-2 max-w-[var(--reading-width)] text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}

function WorkspaceCard({
  eyebrow,
  title,
  description,
  icon,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex size-11 items-center justify-center rounded-lg bg-surface-interactive text-primary">
            {icon}
          </div>
          <Badge>Static reference</Badge>
        </div>
        <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-subtle-foreground">
          {eyebrow}
        </p>
        <h3 className="mb-0 mt-2 text-xl font-semibold tracking-[-0.02em]">
          {title}
        </h3>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const reviewRows = [
  {
    label: 'Reference review item',
    state: 'Current',
    freshness: 'current' as const,
  },
  {
    label: 'Reference review item',
    state: 'Needs review',
    freshness: 'stale' as const,
  },
];

const adminRows = [
  {
    label: 'Configuration example',
    value: 'Enabled',
    state: 'current' as const,
  },
  {
    label: 'Permission example',
    value: 'Restricted',
    state: 'restricted' as const,
  },
  {
    label: 'Operational example',
    value: 'Ready',
    state: 'information' as const,
  },
];

export function FoundationPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,var(--surface-interactive),transparent_52%)] opacity-70"
      />
      <header className="relative border-b bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[var(--content-width)] items-center justify-between gap-4 px-[var(--page-gutter)]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-inverse-foreground">
              <HeartPulse aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-semibold">
                AUD Subjective Monitoring
              </p>
              <p className="m-0 truncate text-xs text-muted-foreground">
                Product foundation
              </p>
            </div>
          </div>
          <Badge variant="information">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Non-live demonstration
          </Badge>
        </div>
      </header>

      <main className="relative mx-auto max-w-[var(--content-width)] px-[var(--page-gutter)] py-10 sm:py-14 lg:py-20">
        <PageHeader
          action={<StateBadge label="Foundation ready" state="current" />}
          description="A shared visual and interaction language designed for calm patient experiences, precise clinical review, and clear operational work. Every example below is static reference content."
          eyebrow="Phase 1 · Design-system reference"
          title="A calm, precise foundation for care"
        />

        <section className="py-12 sm:py-16" aria-label="Design language">
          <SectionHeading
            description="Restrained type, consistent actions, and accessible field treatment establish hierarchy without visual noise."
            index="01"
            title="Design language"
          />
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardContent className="grid gap-8 sm:grid-cols-2">
                <div>
                  <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Typography
                  </p>
                  <p className="mb-0 mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em]">
                    Clear at every level.
                  </p>
                  <p className="mb-0 mt-3 text-base leading-7 text-muted-foreground">
                    Readable language and measured density support attention
                    without creating urgency.
                  </p>
                  <p className="mb-0 mt-5 text-xs font-medium uppercase tracking-[0.1em] text-subtle-foreground">
                    Caption and metadata treatment
                  </p>
                </div>
                <div className="flex flex-col items-start justify-end gap-3 sm:items-stretch">
                  <Button>
                    Primary action{' '}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Button>
                  <Button variant="secondary">Secondary action</Button>
                  <Button variant="outline">Quiet action</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="m-0 text-lg font-semibold">Field treatment</h3>
                <p className="mb-0 mt-2 text-sm text-muted-foreground">
                  Demonstration only. This field does not submit data.
                </p>
              </CardHeader>
              <CardContent className="grid gap-5">
                <FormField
                  helpText="Helpful context remains associated with the control."
                  label="Reference label"
                  placeholder="Enter reference text"
                />
                <FormField
                  defaultValue="Example value"
                  error="Example validation message."
                  label="Validation example"
                  readOnly
                />
                <FormField
                  disabled
                  helpText="Unavailable controls retain a clear explanation."
                  label="Restricted field"
                  value="Not available"
                  readOnly
                />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="pb-12 sm:pb-16" aria-label="Workspace character">
          <SectionHeading
            description="Three levels of information density share the same tokens and behaviors without implying real roles or workflows."
            index="02"
            title="Workspace character"
          />
          <div className="grid gap-5 xl:grid-cols-3">
            <WorkspaceCard
              className="xl:min-h-[31rem]"
              description="Spacious, warm, and deliberate—with one obvious next step and no competing information."
              eyebrow="Patient expression"
              icon={<HeartPulse aria-hidden="true" className="size-5" />}
              title="Patient workspace treatment"
            >
              <div className="rounded-lg border border-success-border bg-success-surface p-5">
                <CheckCircle2
                  aria-hidden="true"
                  className="mb-6 size-6 text-success"
                />
                <p className="m-0 text-lg font-semibold">Supportive status</p>
                <p className="mb-6 mt-2 text-sm leading-6 text-success">
                  Calm reference language with generous space and clear
                  hierarchy.
                </p>
                <Button className="w-full sm:w-auto">Primary action</Button>
              </div>
            </WorkspaceCard>

            <WorkspaceCard
              description="Compact metadata and explicit freshness support review without creating a live case queue."
              eyebrow="Clinician expression"
              icon={<ClipboardCheck aria-hidden="true" className="size-5" />}
              title="Professional review treatment"
            >
              <div className="overflow-hidden rounded-lg border">
                {reviewRows.map((row) => (
                  <div
                    className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                    key={`${row.label}-${row.state}`}
                  >
                    <div>
                      <p className="m-0 text-sm font-semibold">{row.label}</p>
                      <p className="mb-0 mt-1 text-xs text-subtle-foreground">
                        Static metadata example
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StateBadge
                        label={row.state}
                        state={row.state === 'Current' ? 'current' : 'warning'}
                      />
                      <FreshnessBadge freshness={row.freshness} />
                    </div>
                  </div>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard
              description="Tighter rows, aligned values, and explicit state labels create an orderly console character."
              eyebrow="Admin expression"
              icon={<Settings2 aria-hidden="true" className="size-5" />}
              title="Operational console treatment"
            >
              <div className="rounded-lg bg-surface-subtle p-2">
                {adminRows.map((row) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-3 odd:bg-surface"
                    key={row.label}
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-medium">
                        {row.label}
                      </p>
                      <p className="mb-0 mt-0.5 text-xs text-subtle-foreground">
                        {row.value}
                      </p>
                    </div>
                    <StateBadge label={row.value} state={row.state} />
                  </div>
                ))}
              </div>
            </WorkspaceCard>
          </div>
          <p className="mb-0 mt-4 text-xs text-subtle-foreground">
            Static presentation samples — no live, patient, clinical, or
            operational data.
          </p>
        </section>

        <section className="pb-12 sm:pb-16" aria-label="State language">
          <SectionHeading
            description="Text, iconography, border, and semantic color work together so important meaning remains clear in every context."
            index="03"
            title="State language"
          />
          <Card>
            <CardContent className="flex flex-wrap gap-3">
              <StateBadge label="Current" state="current" />
              <StateBadge label="Information" state="information" />
              <StateBadge label="Needs review" state="warning" />
              <StateBadge label="Stale" state="stale" />
              <StateBadge label="Partial" state="partial" />
              <StateBadge label="Restricted" state="restricted" />
              <StateBadge label="Safety-controlled reference" state="safety" />
            </CardContent>
          </Card>
        </section>

        <section className="pb-12 sm:pb-16" aria-label="Forms and interaction">
          <SectionHeading
            description="The reusable confirmation pattern provides keyboard focus management and an explicit decision boundary."
            index="04"
            title="Forms and interaction"
          />
          <Card className="overflow-hidden">
            <CardContent className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-information-surface text-information">
                  <ShieldCheck aria-hidden="true" className="size-5" />
                </div>
                <h3 className="m-0 text-lg font-semibold">
                  Confirmation interaction
                </h3>
                <p className="mb-0 mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  This generic demonstration performs no product action and
                  changes no data.
                </p>
              </div>
              <ConfirmActionDialog
                confirmLabel="Confirm example"
                description="This is a non-live interaction example. Confirming it will not save or change any information."
                title="Confirm the reference action?"
                triggerLabel="Open confirmation example"
              />
            </CardContent>
          </Card>
        </section>

        <section className="pb-8" aria-label="System states">
          <SectionHeading
            description="Representative application states communicate what happened, what it means, and whether an action is available."
            index="05"
            title="System states"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <LoadingState />
            <EmptyState />
            <ErrorState />
            <RestrictedState />
            <SafetyControlledState />
          </div>
        </section>
      </main>

      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-[var(--content-width)] flex-col gap-2 px-[var(--page-gutter)] py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 font-medium text-foreground">
            Foundation reference · Phase 1
          </p>
          <p className="m-0">No clinical workflows are implemented.</p>
        </div>
      </footer>
    </div>
  );
}
