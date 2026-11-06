// The disclosure body of a course card. It stays in the tree so the toggle's
// aria-controls always resolves, but its content mounts only while it is open or
// animating, so a collapsed card registers no section drag source, and a leaving body
// is inert so no stale row takes focus.

import type { ReactNode } from 'react';
import { usePresence } from '@/features/shell/usePresence';

// Matches the .kcp-disclosure open transition (--kcp-duration-base), so a closing
// body unmounts its rows once the collapse has played.
export const DISCLOSURE_MS = 200;

interface CourseBodyProps {
  id: string;
  open: boolean;
  /** Skip the transition, for a change made to many cards at once. */
  instant: boolean;
  /** Builds the content only while it is mounted. */
  renderContent: () => ReactNode;
}

export function CourseBody({
  id,
  open,
  instant,
  renderContent,
}: CourseBodyProps) {
  const { mounted, stage } = usePresence(open, DISCLOSURE_MS, { instant });
  return (
    <div
      id={id}
      data-course-body
      data-stage={stage}
      hidden={!mounted}
      inert={stage === 'leaving' || undefined}
      className="kcp-disclosure"
    >
      <div>{mounted ? renderContent() : null}</div>
    </div>
  );
}
