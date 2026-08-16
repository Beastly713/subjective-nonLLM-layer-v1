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
    <main className="grid min-h-screen place-items-center px-[var(--page-gutter)] py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3 text-primary">
          <span className="grid size-10 place-items-center rounded-lg bg-surface-interactive">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <span className="text-sm font-semibold tracking-wide">
            AUD secure access
          </span>
        </div>
        <Card>
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
