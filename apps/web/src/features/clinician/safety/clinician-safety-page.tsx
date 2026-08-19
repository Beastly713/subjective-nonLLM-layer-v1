import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { z } from 'zod';
import { ClinicianShell } from '@/app/shells/clinician-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { apiGet } from '@/lib/api/client';

const CaseList = z.object({ items: z.array(z.object({ id: z.string(), patientId: z.string(), severity: z.string(), domain: z.string(), lifecycle: z.string(), routeStatus: z.string(), version: z.number() })) });

export function ClinicianSafetyPage() {
  const query = useQuery({ queryKey: ['clinician', 'safety-cases'], queryFn: ({ signal }) => apiGet('/api/v1/clinician/safety-cases', { schema: CaseList, signal }) });
  return (
    <ClinicianShell>
      <div className="mb-6 flex items-center gap-3">
        <ShieldAlert className="size-6 text-warning" />
        <div>
          <h1 className="m-0 text-2xl font-semibold">Safety cases</h1>
          <p className="m-0 text-sm text-muted-foreground">Assigned patient handoffs and reviews.</p>
        </div>
      </div>
      {query.isLoading ? <p>Loading safety cases...</p> : null}
      {query.isError ? <p>Safety cases could not be loaded.</p> : null}
      <div className="grid gap-3">
        {query.data?.items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <p className="m-0 text-sm text-muted-foreground">{item.patientId}</p>
                <h2 className="m-0 text-lg font-semibold">{item.domain}</h2>
              </div>
              <Badge>{item.severity}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p className="m-0">Lifecycle: {item.lifecycle}</p>
              <p className="m-0">Route: {item.routeStatus}</p>
              <p className="m-0 text-muted-foreground">Version {item.version}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </ClinicianShell>
  );
}
