export interface DedupeRow {
  id: string;
  duplicate: boolean;
  slot: number;
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

export interface StoryBlock {
  subjectId: string;
  section: string;
  day: number;
  dayLabel: string;
  start: number;
  end: number;
  time: string;
  name: string | null;
  credit: number;
  subjectClass: string;
}

export interface Story {
  blocks: StoryBlock[];
  ghost: StoryBlock;
  landed: StoryBlock;
  blocker: StoryBlock;
  credits: number;
  subjects: number;
}

export const DEDUPE_FIXTURE: string;
export const STORY_FIXTURE: string;
export function storyBlocks(locale: 'th' | 'en'): Story;
export function dedupeRows(locale: 'th' | 'en'): DedupeRow[];
export function dedupeCounts(): DedupeCounts;
export function renderDedupeRows(locale: 'th' | 'en'): string;
export function extensionVersion(): string;
