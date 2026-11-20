// Whether the launcher asks for attention with its ring, as a pure choice, following
// the entry toast and launcher attention ADR. The ring is due in two cases. A student who
// has never used the planner sees it until the panel first opens, unless they already
// have stored plans (ADR-0063). Every student sees it once the selector coach mark is
// dismissed with Maybe later or Not again today in this document, whatever their plans
// or history, so the planner they just put off stays easy to find (ADR-0072). It never
// plays under the welcome or the coach mark, so it starts once either closes rather than
// behind its scrim. It waits for everything it reads to settle, so it never judges the
// empty state that precedes the reads.

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
  /** The student dismissed the coach mark with Maybe later or Not again today in this
   * document. Pressing the launcher to open the panel is not a dismissal. */
  coachMarkDismissed: boolean;
}

export function needsLauncherAttention({
  loaded,
  record,
  hasStoredPlans,
  welcomeOpen,
  coachMarkOpen,
  coachMarkDismissed,
}: LauncherAttentionInput): boolean {
  if (!loaded || welcomeOpen || coachMarkOpen) return false;
  if (coachMarkDismissed) return true;
  return record.panelFirstOpenedAt === undefined && !hasStoredPlans;
}
