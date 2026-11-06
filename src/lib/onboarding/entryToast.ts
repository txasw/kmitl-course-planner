// What the entry toast near the launcher says on a visit, as a pure choice, following the
// entry toast and launcher attention ADR. The toast is a prompt, not action feedback: it
// shows at most once per document, after everything it depends on has settled, and never
// while the panel or the welcome is open. The content follows a fixed precedence, most
// useful first: changes that still wait for review, then a plan with subjects, then an
// empty plan, then no plan at all.

import type { Plan, PlanEntry } from '../domain/plan';
import { summarizeCredits } from '../planner/credits';
import { countUpdateItems } from '../planner/updateReview';

/** The wait after everything settles, counted only while the document is visible. */
export const ENTRY_TOAST_DELAY_MS = 2000;
/** How long the toast stays, paused while it is hovered or holds focus. */
export const ENTRY_TOAST_VISIBLE_MS = 8000;
/** The longest plan name the toast states, in graphemes, marker included. */
export const ENTRY_TOAST_NAME_MAX = 40;

const NAME_MARKER = '...';

/** Where the toast's action opens the panel. */
export type EntryToastTarget = 'updates' | 'timetable' | 'catalog';

export type EntryToastContent =
  | {
      kind: 'updates';
      messageKey: 'entryToast.updates';
      actionKey: 'entryToast.updates.action';
      params: { name: string; count: number };
      target: 'updates';
    }
  | {
      kind: 'plan';
      messageKey: 'entryToast.plan';
      actionKey: 'entryToast.plan.action';
      params: { name: string; count: number };
      target: 'timetable';
    }
  | {
      kind: 'planEmpty';
      messageKey: 'entryToast.planEmpty';
      actionKey: 'entryToast.planEmpty.action';
      params: { name: string };
      target: 'catalog';
    }
  | {
      kind: 'noPlan';
      messageKey: 'entryToast.noPlan';
      actionKey: 'entryToast.noPlan.action';
      params: Record<string, never>;
      target: 'catalog';
    };

/** The entry fields the choice reads: the review state and the subject with its credit. */
export type EntryToastEntry = Pick<
  PlanEntry,
  'subjectId' | 'review' | 'verifyStatus'
> & {
  snapshot: {
    subjectMeta: Pick<PlanEntry['snapshot']['subjectMeta'], 'credit'>;
  };
};

export interface EntryToastInput {
  /** The active plan, or null when the student has none. */
  plan: (Pick<Plan, 'name'> & { entries: readonly EntryToastEntry[] }) | null;
  /** The one field of the onboarding record the choice reads. */
  onboarding: Readonly<{ entryToastOptOutAt?: string | undefined }>;
  isOpen: boolean;
  welcomeOpen: boolean;
  /** True once this document showed the welcome, applied a requested open, or found the
   * welcome pending at load. */
  documentSuppressed: boolean;
  /** The plan and the onboarding record are loaded, and the handshake and the welcome
   * decision have settled. */
  settled: boolean;
}

function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  // Without a segmenter, a combining mark stays with the code point before it, so a Thai
  // vowel or tone mark is never cut from its consonant.
  return text.match(/\P{M}\p{M}*|\p{M}+/gu) ?? [];
}

/**
 * The plan name as the toast states it: at most ENTRY_TOAST_NAME_MAX graphemes, cut on a
 * grapheme boundary with a marker when longer, so no half character ever ends the name.
 */
export function clampEntryToastName(name: string): string {
  const parts = graphemes(name);
  if (parts.length <= ENTRY_TOAST_NAME_MAX) {
    return name;
  }
  const kept = parts
    .slice(0, ENTRY_TOAST_NAME_MAX - NAME_MARKER.length)
    .join('');
  return `${kept.trimEnd()}${NAME_MARKER}`;
}

/** What the entry toast shows on this visit, or null when it must not show. */
export function selectEntryToast(
  input: EntryToastInput,
): EntryToastContent | null {
  if (
    !input.settled ||
    input.onboarding.entryToastOptOutAt !== undefined ||
    input.isOpen ||
    input.welcomeOpen ||
    input.documentSuppressed
  ) {
    return null;
  }
  const { plan } = input;
  if (plan === null) {
    return {
      kind: 'noPlan',
      messageKey: 'entryToast.noPlan',
      actionKey: 'entryToast.noPlan.action',
      params: {},
      target: 'catalog',
    };
  }
  const name = clampEntryToastName(plan.name);
  const updates = countUpdateItems(plan.entries);
  if (updates > 0) {
    return {
      kind: 'updates',
      messageKey: 'entryToast.updates',
      actionKey: 'entryToast.updates.action',
      params: { name, count: updates },
      target: 'updates',
    };
  }
  if (plan.entries.length === 0) {
    return {
      kind: 'planEmpty',
      messageKey: 'entryToast.planEmpty',
      actionKey: 'entryToast.planEmpty.action',
      params: { name },
      target: 'catalog',
    };
  }
  const { subjects } = summarizeCredits(
    plan.entries.map((entry) => ({
      subjectId: entry.subjectId,
      credit: entry.snapshot.subjectMeta.credit,
    })),
  );
  return {
    kind: 'plan',
    messageKey: 'entryToast.plan',
    actionKey: 'entryToast.plan.action',
    params: { name, count: subjects },
    target: 'timetable',
  };
}
