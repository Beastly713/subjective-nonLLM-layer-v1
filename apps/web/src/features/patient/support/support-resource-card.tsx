import type {
  ContentFeedbackOutcome,
  ContentResourceView,
} from '@aud-subjective/contracts';

import { ConfirmActionDialog } from '@/components/patterns/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SafeMarkdown } from './safe-markdown';

type SupportResourceCardProps = {
  resource: ContentResourceView;
  eyebrow: string;
  onFeedback: (
    resource: ContentResourceView,
    outcome: ContentFeedbackOutcome,
  ) => Promise<void>;
  hidden?: boolean;
};

export function SupportResourceCard({
  resource,
  eyebrow,
  onFeedback,
  hidden = false,
}: SupportResourceCardProps) {
  if (hidden) return null;
  return (
    <Card>
      <CardHeader>
        <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mb-0 mt-2 text-xl font-semibold">{resource.title}</h2>
        <p className="mb-0 mt-2 text-sm text-muted-foreground">
          About{' '}
          {Math.max(1, Math.round(resource.estimatedDurationSeconds / 60))}{' '}
          minute{resource.estimatedDurationSeconds >= 120 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <SafeMarkdown value={resource.bodyMarkdown} />
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            onClick={() =>
              void onFeedback(resource, 'DISMISS').catch(() => undefined)
            }
            variant="ghost"
          >
            Dismiss
          </Button>
          <Button
            onClick={() =>
              void onFeedback(resource, 'NOT_HELPFUL').catch(() => undefined)
            }
            variant="outline"
          >
            Not helpful
          </Button>
          <ConfirmActionDialog
            cancelLabel="Keep this type"
            confirmLabel="Hide this type"
            description="This will hide this kind of support from future recommendations until you explicitly restore it in Support preferences."
            intent="destructive"
            onConfirm={() => onFeedback(resource, 'DONT_SHOW_THIS_TYPE')}
            title="Hide this support type?"
            triggerLabel="Hide this type"
          />
        </div>
      </CardContent>
    </Card>
  );
}
