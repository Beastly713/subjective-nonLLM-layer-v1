import { CheckCircle2, LockKeyhole } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function AccountStep() {
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-sm font-semibold text-primary">Start here</p>
        <h2 className="m-0 mt-1 text-2xl font-semibold">
          A setup that can pause and resume
        </h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
          We will use a few short screens to understand your context and your
          preferred direction. Each step is saved as you go, so you can return
          without starting over.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-lg border bg-surface-subtle p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div>
              <p className="m-0 font-semibold">
                Your account is already linked
              </p>
              <p className="mb-0 mt-1 text-sm text-muted-foreground">
                Identity and profile details are managed separately from this
                setup.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border bg-surface-subtle p-4">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="m-0 font-semibold">
                Your answers stay in your draft
              </p>
              <p className="mb-0 mt-1 text-sm text-muted-foreground">
                Nothing is submitted as an authoritative assessment until you
                finish.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
