import { describe, it, expect } from 'vitest';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';

describe('blockBadge', () => {
  it('is danger for a missing section', () => {
    expect(blockBadge('missing', false, false)).toBe('danger');
  });

  it('is danger for a conflicted section', () => {
    expect(blockBadge('verified', true, false)).toBe('danger');
  });

  it('is warn for a changed section', () => {
    expect(blockBadge('changed', false, false)).toBe('warn');
  });

  it('is danger for an exam conflicting section', () => {
    expect(blockBadge('verified', false, true)).toBe('danger');
  });

  it('lets an exam conflict win danger over a mere change', () => {
    expect(blockBadge('changed', false, true)).toBe('danger');
  });

  it('is null for a verified section with no state', () => {
    expect(blockBadge('verified', false, false)).toBeNull();
    expect(blockBadge('unverified', false, false)).toBeNull();
  });
});

describe('blockBadgeLabelKeys', () => {
  it('labels missing before a conflict', () => {
    expect(blockBadgeLabelKeys('missing', true, false)).toEqual([
      'verify.missing',
      'verify.conflict',
    ]);
  });

  it('labels a conflict when the section is not missing', () => {
    expect(blockBadgeLabelKeys('verified', true, false)).toEqual([
      'verify.conflict',
    ]);
  });

  it('labels an exam overlap in the danger group, before a change, and lists both', () => {
    expect(blockBadgeLabelKeys('changed', false, true)).toEqual([
      'verify.examOverlap',
      'verify.changed',
    ]);
  });

  it('lists a time conflict and an exam overlap together, time first', () => {
    expect(blockBadgeLabelKeys('missing', true, true)).toEqual([
      'verify.missing',
      'verify.conflict',
      'verify.examOverlap',
    ]);
  });

  it('is empty for a verified section with no state', () => {
    expect(blockBadgeLabelKeys('verified', false, false)).toEqual([]);
  });
});
