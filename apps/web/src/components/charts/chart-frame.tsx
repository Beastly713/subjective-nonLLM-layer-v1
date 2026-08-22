import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ChartFrame({
  title,
  description,
  children,
  fallback,
}: {
  title: string;
  description: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        <p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </CardHeader>
      <CardContent>
        {children}
        {fallback ? <div className="mt-5">{fallback}</div> : null}
      </CardContent>
    </Card>
  );
}
