import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-subtle px-[var(--page-gutter)] py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-primary">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-inverse-foreground shadow-[var(--shadow-sm)]">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="m-0 text-sm font-semibold tracking-wide">
                AUD secure access
              </p>
              <p className="m-0 text-xs text-muted-foreground">
                Subjective monitoring workspace
              </p>
            </div>
          </div>
        </div>
        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader>
            <h1 className="m-0 text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
