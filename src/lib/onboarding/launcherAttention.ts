// Whether the launcher asks for attention with its ring, as a pure choice, following
// the entry toast and launcher attention ADR. The ring is for a student who has never
// used the planner: it plays only until the panel first opens, never for a student who
// already has stored plans, and never under the welcome or the selector coach mark, so
// it starts once either closes rather than behind its scrim (ADR-0072). It waits for
// everything it reads to settle, so it never judges the empty state that precedes the
// reads.

import type { OnboardingRecord } from '../storage/onboarding';

export interface LauncherAttentionInput {
  /** The plan and onboarding reads have settled and the document has decided whether
   * it shows the welcome. */
  loaded: boolean;
  /** The one field of the onboarding record the choice reads. */
  record: Readonly<Pick<OnboardingRecord, 'panelFirstOpenedAt'>>;
  hasStoredPlans: boolean;
  welcomeOpen: boolean;
  coachMarkOpen: boolean;
}

export function needsLauncherAttention({
  loaded,
  record,
  hasStoredPlans,
  welcomeOpen,
  coachMarkOpen,
}: LauncherAttentionInput): boolean {
  return (
    loaded &&
    record.panelFirstOpenedAt === undefined &&
    !hasStoredPlans &&
    !welcomeOpen &&
    !coachMarkOpen
  );
}
