import { LoaderCircle, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function OnboardingNavigation({
  onSave,
  onContinue,
  saving,
  continueLabel = 'Save and continue',
}: {
  onSave: () => void;
  onContinue: () => void;
  saving: boolean;
  continueLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-3 border-t pt-5">
      <Button disabled={saving} onClick={onContinue} type="button">
        {saving ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {saving ? 'Saving…' : continueLabel}
      </Button>
      <Button
        disabled={saving}
        onClick={onSave}
        type="button"
        variant="secondary"
      >
        <Save aria-hidden="true" className="size-4" />
        Save progress
      </Button>
    </div>
  );
}
