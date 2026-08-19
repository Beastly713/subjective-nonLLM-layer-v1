import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { z } from 'zod';
import { AdminShell } from '@/app/shells/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { apiGet } from '@/lib/api/client';

const CaseList = z.object({ items: z.array(z.object({ id: z.string(), patientId: z.string(), severity: z.string(), domain: z.string(), ownerRole: z.string(), lifecycle: z.string(), routeStatus: z.string(), routeProfileLogicalVersion: z.number().nullable() })) });

export function AdminSafetyPage() {
  const query = useQuery({ queryKey: ['admin', 'safety-cases'], queryFn: ({ signal }) => apiGet('/api/v1/admin/safety-cases', { schema: CaseList, signal }) });
  return (
    <AdminShell>
      <div className="mb-6 flex items-center gap-3">
        <Activity className="size-6 text-primary" />
        <div>
          <h1 className="m-0 text-2xl font-semibold">Safety operations</h1>
          <p className="m-0 text-sm text-muted-foreground">Read-only operational case and routing status.</p>
        </div>
      </div>
      {query.isLoading ? <p>Loading safety operations...</p> : null}
      {query.isError ? <p>Safety operations could not be loaded.</p> : null}
      <div className="grid gap-3">
        {query.data?.items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <p className="m-0 text-sm text-muted-foreground">{item.id}</p>
                <h2 className="m-0 text-lg font-semibold">{item.domain}</h2>
              </div>
              <Badge>{item.routeStatus}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p className="m-0">Patient: {item.patientId}</p>
              <p className="m-0">Owner: {item.ownerRole}</p>
              <p className="m-0">Lifecycle: {item.lifecycle}</p>
              <p className="m-0">Severity: {item.severity}</p>
              <p className="m-0 text-muted-foreground">Route profile version {item.routeProfileLogicalVersion ?? 'unavailable'}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
