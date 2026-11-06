// The totals both plan summaries state, the edit stats bar and the poster footer line:
// credits including unscheduled sections, the distinct subject count, the scheduled load
// per day, and the count of sections with no meeting. One derivation keeps the two
// summaries from ever disagreeing on a number.

import { summarizeCredits } from '@/lib/planner/credits';
import { perDayLoad, type PerDayLoad } from '@/lib/planner/grid';
import type { PlacedSection } from './placedSection';

export interface PlanTotals {
  credits: number;
  subjects: number;
  /** Scheduled minutes per day, Sunday first. */
  load: PerDayLoad;
  unscheduled: number;
}

export function planTotals(sections: readonly PlacedSection[]): PlanTotals {
  const { credits, subjects } = summarizeCredits(
    sections.map((section) => ({
      subjectId: section.subjectId,
      credit: section.credit,
    })),
  );
  return {
    credits,
    subjects,
    load: perDayLoad(sections.flatMap((section) => section.meetings)),
    unscheduled: sections.filter((section) => section.meetings.length === 0)
      .length,
  };
}
