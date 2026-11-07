export interface DedupeRow {
  id: string;
  duplicate: boolean;
  chip: string | null;
  subjectClass: string;
  grouping: string;
  subjectId: string;
  name: string;
  section: string;
  time: string;
  seats: string;
}

export interface DedupeCounts {
  rows: number;
  sections: number;
  groupings: number;
}

export const DEDUPE_FIXTURE: string;
export function dedupeRows(locale: 'th' | 'en'): DedupeRow[];
export function dedupeCounts(): DedupeCounts;
export function renderDedupeRows(locale: 'th' | 'en'): string;
export function extensionVersion(): string;
