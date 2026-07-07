// Credit totals for a plan. A subject contributes its credit once even when both
// its lecture and practice sections are placed, so the calculator counts distinct
// subjects. It takes plain subject and credit pairs rather than the plan type, so
// it stays independent of how a plan stores its entries.

export interface CreditedSubject {
  subjectId: string;
  credit: number;
}

export interface CreditSummary {
  credits: number;
  subjects: number;
}

/** Total credits and distinct subject count, counting each subject once. */
export function summarizeCredits(subjects: CreditedSubject[]): CreditSummary {
  const creditBySubject = new Map<string, number>();
  for (const subject of subjects) {
    if (!creditBySubject.has(subject.subjectId)) {
      creditBySubject.set(subject.subjectId, subject.credit);
    }
  }
  let credits = 0;
  for (const credit of creditBySubject.values()) {
    credits += credit;
  }
  return { credits, subjects: creditBySubject.size };
}

/** Total credits across distinct subjects. */
export function totalCredits(subjects: CreditedSubject[]): number {
  return summarizeCredits(subjects).credits;
}
