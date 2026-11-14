// Build a link to the host's own result page for one subject, the reverse of
// parseTeachTableRoute. The host result component reads its search from the
// #/teach_table route query when it is created and fetches the listing itself, and
// the host builds the same by_subject_id link for its own subject rows, so a fresh
// tab opened on this URL shows the official listing. The params are the exact ones
// the subject id tab sends to the API (Section 6.2), so the page shows the same
// sections the planner read. Opening the link is the only thing done with it: the
// host is never navigated or driven from the extension (Section 2, rule 6).

import { toSourceQuery } from '../planner/sourceQuery';
import { buildSubjectIdQuery, isValidSubjectId } from '../search/formState';
import { REGIS_ORIGIN } from '../shell/hostTab';
import type { Term } from './academicTerms';

/** The host result route a teach table search lands on. */
const RESULT_ROUTE = '/teach_table';

/**
 * The host result page URL that runs the given teach table search params. Each key and
 * value is percent encoded rather than form encoded, because the host router decodes
 * its query with decodeURIComponent, which reads a form encoded space (+) as a plus.
 */
export function teachTableUrl(params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  return `${REGIS_ORIGIN}/#${RESULT_ROUTE}?${query}`;
}

/**
 * The host result page URL listing every section of one subject in a term, or null
 * when the subject id is not the 8 digit course code the host accepts.
 */
export function subjectListingUrl(
  term: Term,
  subjectId: string,
): string | null {
  if (!isValidSubjectId(subjectId)) {
    return null;
  }
  const query = buildSubjectIdQuery(term, { subjectId });
  return teachTableUrl(toSourceQuery(query).params);
}
