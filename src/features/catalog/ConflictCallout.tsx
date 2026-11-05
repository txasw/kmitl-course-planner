// The inline callout a conflicting catalog row shows under its details. It is a quiet
// danger soft box rather than a bare red line, so the reason reads as one unit beside
// the badge instead of a third red cue. The text goes through the same conflictText
// funnel as the reason chip and the feedback strip, so a row names a time or exam
// clash, its blocking section, and the count of further conflicts in the same words a
// drag would use. The id lets the add rail point its description at the callout.

import { AlertTriangle } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import type { ConflictDescription } from '@/lib/planner/describeConflict';
import { conflictReasonText } from '@/features/planner/conflictText';

interface ConflictCalloutProps {
  id: string;
  description: ConflictDescription;
  t: Translate;
}

export function ConflictCallout({ id, description, t }: ConflictCalloutProps) {
  return (
    <p
      id={id}
      className="mt-1 flex items-start gap-1 rounded-kcp-inner bg-danger-soft px-2 py-1 text-danger"
    >
      <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0" />
      <span>{conflictReasonText(description, t)}</span>
    </p>
  );
}
