// The copy for a term mismatch. Each message is one dictionary sentence with the two
// terms placed by name, so Thai and English can each order and join them naturally
// rather than concatenating fragments with a fixed period. The switch action names
// what it does: it opens the plan a term already has, or creates one when it has none,
// so a student is never surprised by a new plan.

import type { Term } from '@/lib/routing/academicTerms';
import { termText } from '@/lib/routing/academicTerms';
import type { Translate } from './t';
import { fillTemplate } from './template';

/** What the other term belongs to: one section, or the whole browsed result. */
export type TermMismatchSubject = 'section' | 'browsing';

/** The switch action label: open the term's plan, or create one when none exists. */
export function termSwitchLabel(
  hasPlan: boolean,
  term: Term,
  t: Translate,
): string {
  return fillTemplate(t(hasPlan ? 'term.open' : 'term.create'), {
    term: termText(term),
  });
}

/** One sentence naming the active plan's term and the other term. */
export function termMismatchText(
  planTerm: Term,
  otherTerm: Term,
  subject: TermMismatchSubject,
  t: Translate,
): string {
  const key =
    subject === 'section' ? 'term.mismatch.section' : 'term.mismatch.browsing';
  return fillTemplate(t(key), {
    plan: termText(planTerm),
    browsed: termText(otherTerm),
  });
}
