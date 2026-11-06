// What the verification status says about the active plan, in one place for the status item
// on screen and for the announcement a manual check settles with, so the two never word the
// same outcome differently. A check in flight says so. A run that reached no source query
// renders from the saved snapshots, the unverified state of brief section 6.6 step 6, and a
// run that reached only some says which time it holds and that some entries were not
// checked; both are warn. Otherwise the plan reads as checked at its data date, the oldest
// verification, with the changed and missing counts of the latest run when it found any, or
// as not checked yet when no entry was ever verified.

import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { DataDate } from '@/lib/planner/posterHonesty';
import type { RevalidationRun } from '@/features/plans/revalidationStore';
import { formatMinutes } from '@/lib/parsing/time';
import { formatLocalDateTime } from './examText';

export type VerificationTone = 'checking' | 'ok' | 'changed' | 'warn' | 'none';

export interface VerificationText {
  tone: VerificationTone;
  text: string;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The time of a check: the clock time for a check today, the date and time otherwise. */
export function checkedTime(at: string, now: Date, t: Translate): string {
  const date = new Date(at);
  return sameLocalDay(date, now)
    ? formatMinutes(date.getHours() * 60 + date.getMinutes())
    : formatLocalDateTime(date, t);
}

function runCounts(run: RevalidationRun | null, t: Translate): string[] {
  const summary = run?.report?.summary;
  if (summary === undefined) {
    return [];
  }
  const counts: string[] = [];
  if (summary.changed > 0) {
    counts.push(
      fillTemplate(t('revalidation.changedCount'), { count: summary.changed }),
    );
  }
  if (summary.missing > 0) {
    counts.push(
      fillTemplate(t('revalidation.missingCount'), { count: summary.missing }),
    );
  }
  return counts;
}

export function verificationText(
  run: RevalidationRun | null,
  dataDate: DataDate,
  now: Date,
  t: Translate,
): VerificationText {
  if (run?.status === 'running') {
    return { tone: 'checking', text: t('revalidation.checking') };
  }
  if (run?.status === 'offline') {
    return { tone: 'warn', text: t('revalidation.offline') };
  }
  const partial = run?.status === 'partial';
  if (dataDate.kind === 'unverified' && !partial) {
    return { tone: 'none', text: t('revalidation.notYet') };
  }
  const lead =
    dataDate.kind === 'unverified'
      ? t('revalidation.notYet')
      : fillTemplate(t('revalidation.checkedAt'), {
          time: checkedTime(dataDate.at, now, t),
        });
  const counts = runCounts(run, t);
  const parts = [lead, ...counts];
  if (partial) {
    parts.push(t('revalidation.partial'));
  }
  let tone: VerificationTone = counts.length === 0 ? 'ok' : 'changed';
  if (partial) {
    tone = 'warn';
  }
  return { tone, text: parts.join(t('revalidation.separator')) };
}
