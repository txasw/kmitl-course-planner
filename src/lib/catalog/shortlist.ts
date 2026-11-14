// The per term course shortlist (ADR-0069): the subject ids a student saved for a
// later look, keyed by the semester over the year of the browsed term. The map is
// immutable; every change returns a new one and a term whose last course goes drops
// out, so the stored blob only ever holds terms with saved courses.

import { z } from 'zod';
import { termText, type Term } from '../routing/academicTerms';

const TERM_KEY = /^[123]\/\d{4}$/;

// A subject id is only compared, never rendered, so its bound is a length rather than
// the eight digit form: the API schema accepts any string there, and one saved id
// outside a stricter pattern would make the whole map read as absent on the next load.
export const shortlistSchema = z.record(
  z.string().regex(TERM_KEY),
  z.array(z.string().min(1).max(32)),
);
export type Shortlist = z.infer<typeof shortlistSchema>;

export const EMPTY_SHORTLIST: Shortlist = {};

/** The saved subject ids of one term, empty when the term has none. */
export function termShortlist(
  shortlist: Shortlist,
  term: Term,
): readonly string[] {
  return shortlist[termText(term)] ?? [];
}

/** Whether a course is saved for the term. */
export function isShortlisted(
  shortlist: Shortlist,
  term: Term,
  subjectId: string,
): boolean {
  return termShortlist(shortlist, term).includes(subjectId);
}

/** The map with the term holding these ids, or without the term when none are left. */
function withTermIds(
  shortlist: Shortlist,
  key: string,
  ids: string[],
): Shortlist {
  if (ids.length > 0) {
    return { ...shortlist, [key]: ids };
  }
  return Object.fromEntries(
    Object.entries(shortlist).filter(([entryKey]) => entryKey !== key),
  );
}

/** Saves the course for the term, or removes it when it is already saved. */
export function toggleShortlisted(
  shortlist: Shortlist,
  term: Term,
  subjectId: string,
): Shortlist {
  const key = termText(term);
  const current = shortlist[key] ?? [];
  return withTermIds(
    shortlist,
    key,
    current.includes(subjectId)
      ? current.filter((id) => id !== subjectId)
      : [...current, subjectId],
  );
}

/**
 * Replays the changes made between the initial and the current map onto the stored
 * one, per term, so a course saved or removed while the stored map was still loading
 * joins the stored courses rather than replacing every term of them.
 */
export function rebaseShortlist(
  stored: Shortlist,
  initial: Shortlist,
  current: Shortlist,
): Shortlist {
  let result = stored;
  for (const key of new Set([
    ...Object.keys(initial),
    ...Object.keys(current),
  ])) {
    const before = initial[key] ?? [];
    const after = current[key] ?? [];
    const kept = (result[key] ?? []).filter(
      (id) => after.includes(id) || !before.includes(id),
    );
    const added = after.filter(
      (id) => !before.includes(id) && !kept.includes(id),
    );
    result = withTermIds(result, key, [...kept, ...added]);
  }
  return result;
}

/** Whether any term holds a saved course. */
export function hasShortlist(shortlist: Shortlist): boolean {
  return Object.keys(shortlist).length > 0;
}
