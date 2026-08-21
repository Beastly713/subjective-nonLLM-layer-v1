import { Link } from 'react-router';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { usePatientSupport } from './use-patient-support';
import { SafeMarkdown } from './safe-markdown';

export function PostCheckInSupport() {
  const query = usePatientSupport();
  const support = query.data;
  if (
    !support ||
    support.status === 'SAFETY_CONTROLLED' ||
    support.status === 'NO_CURRENT_SUPPORT'
  ) {
    return null;
  }
  if (support.status === 'CONTENT_UNAVAILABLE') {
    return (
      <Card>
        <CardHeader>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Optional support
          </p>
          <h2 className="mb-0 mt-2 text-xl font-semibold">
            Your check-in was saved
          </h2>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            No support resource currently matches this check-in. Your monitoring
            record is preserved, and you can browse Support if you would like to
            explore another eligible option.
          </p>
          <Link className="inline-flex w-fit" to="/patient/support">
            Open Support
          </Link>
        </CardContent>
      </Card>
    );
  }
  const resources = [support.primary, support.secondary].filter(
    (resource): resource is NonNullable<typeof support.primary> =>
      Boolean(resource),
  );
  if (resources.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">
          Support selected for you
        </p>
        <h2 className="mb-0 mt-2 text-xl font-semibold">
          A few optional next steps
        </h2>
        <p className="mb-0 mt-2 text-sm text-muted-foreground">
          These are based on the submitted check-in. Open Support to explore or
          share feedback.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {resources.map((resource) => (
          <article
            className="grid gap-3 border-t pt-4 first:border-t-0 first:pt-0"
            key={resource.resourceId}
          >
            <h3 className="m-0 text-lg font-semibold">{resource.title}</h3>
            <SafeMarkdown value={resource.bodyMarkdown} />
          </article>
        ))}
        <Link className="inline-flex w-fit" to="/patient/support">
          Open Support
        </Link>
      </CardContent>
    </Card>
  );
}
