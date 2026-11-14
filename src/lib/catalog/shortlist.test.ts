import { describe, it, expect } from 'vitest';
import {
  EMPTY_SHORTLIST,
  hasShortlist,
  isShortlisted,
  rebaseShortlist,
  shortlistSchema,
  termShortlist,
  toggleShortlisted,
} from './shortlist';

const TERM = { year: '2569', semester: '1' } as const;
const NEXT = { year: '2569', semester: '2' } as const;

describe('toggleShortlisted', () => {
  it('saves a course for its term only', () => {
    const saved = toggleShortlisted(EMPTY_SHORTLIST, TERM, '90592033');
    expect(saved).toEqual({ '1/2569': ['90592033'] });
    expect(isShortlisted(saved, TERM, '90592033')).toBe(true);
    expect(isShortlisted(saved, NEXT, '90592033')).toBe(false);
    expect(EMPTY_SHORTLIST).toEqual({});
  });

  it('keeps the save order and removes a saved course', () => {
    let saved = toggleShortlisted(EMPTY_SHORTLIST, TERM, '90592033');
    saved = toggleShortlisted(saved, TERM, '01006001');
    expect(termShortlist(saved, TERM)).toEqual(['90592033', '01006001']);
    saved = toggleShortlisted(saved, TERM, '90592033');
    expect(termShortlist(saved, TERM)).toEqual(['01006001']);
  });

  it('drops a term once its last course is removed', () => {
    let saved = toggleShortlisted(EMPTY_SHORTLIST, TERM, '90592033');
    saved = toggleShortlisted(saved, NEXT, '01006001');
    saved = toggleShortlisted(saved, TERM, '90592033');
    expect(saved).toEqual({ '2/2569': ['01006001'] });
    expect(hasShortlist(saved)).toBe(true);
    expect(hasShortlist(toggleShortlisted(saved, NEXT, '01006001'))).toBe(
      false,
    );
  });

  it('reads an unknown term as empty', () => {
    expect(termShortlist(EMPTY_SHORTLIST, TERM)).toEqual([]);
  });
});

describe('rebaseShortlist', () => {
  const stored = { '1/2569': ['90592033'], '2/2569': ['01006001'] };

  it('joins a course saved during the read to the stored terms', () => {
    const current = toggleShortlisted(EMPTY_SHORTLIST, TERM, '01006002');
    expect(rebaseShortlist(stored, EMPTY_SHORTLIST, current)).toEqual({
      '1/2569': ['90592033', '01006002'],
      '2/2569': ['01006001'],
    });
  });

  it('does not repeat a course saved both before and during the read', () => {
    const current = toggleShortlisted(EMPTY_SHORTLIST, TERM, '90592033');
    expect(rebaseShortlist(stored, EMPTY_SHORTLIST, current)).toEqual(stored);
  });

  it('applies a removal and drops a term left empty', () => {
    const initial = { '2/2569': ['01006001'] };
    expect(rebaseShortlist(stored, initial, EMPTY_SHORTLIST)).toEqual({
      '1/2569': ['90592033'],
    });
  });

  it('keeps the stored map when nothing changed', () => {
    expect(rebaseShortlist(stored, stored, stored)).toEqual(stored);
  });
});

describe('shortlistSchema', () => {
  it('accepts term keys of the semester over the year', () => {
    expect(shortlistSchema.safeParse({ '3/2568': ['90592033'] }).success).toBe(
      true,
    );
  });

  it('accepts a subject id outside the eight digit form', () => {
    // The API schema takes any string as a subject id, so a stricter pattern here
    // would let one odd saved id cost every saved course on the next load.
    expect(shortlistSchema.safeParse({ '1/2569': ['9059-033'] }).success).toBe(
      true,
    );
  });

  it('rejects a malformed term key or subject id', () => {
    expect(shortlistSchema.safeParse({ '2569-1': ['90592033'] }).success).toBe(
      false,
    );
    expect(shortlistSchema.safeParse({ '1/2569': [''] }).success).toBe(false);
    expect(
      shortlistSchema.safeParse({ '1/2569': ['9'.repeat(33)] }).success,
    ).toBe(false);
    expect(shortlistSchema.safeParse({ '1/2569': '90592033' }).success).toBe(
      false,
    );
  });
});
