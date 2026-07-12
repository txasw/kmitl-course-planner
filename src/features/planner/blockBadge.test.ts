import { describe, it, expect } from 'vitest';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';

describe('blockBadge', () => {
  it('is danger for a missing section', () => {
    expect(blockBadge('missing', false)).toBe('danger');
  });

  it('is danger for a conflicted section', () => {
    expect(blockBadge('verified', true)).toBe('danger');
  });

  it('is warn for a changed section', () => {
    expect(blockBadge('changed', false)).toBe('warn');
  });

  it('is danger for an exam conflicting section', () => {
    expect(blockBadge('verified', false, true)).toBe('danger');
  });

  it('lets an exam conflict win danger over a mere change', () => {
    expect(blockBadge('changed', false, true)).toBe('danger');
  });

  it('is null for a verified section with no state', () => {
    expect(blockBadge('verified', false)).toBeNull();
    expect(blockBadge('unverified', false)).toBeNull();
  });
});

describe('blockBadgeLabelKeys', () => {
  it('labels missing before a conflict', () => {
    expect(blockBadgeLabelKeys('missing', true)).toEqual([
      'verify.missing',
      'verify.conflict',
    ]);
  });

  it('labels a conflict when the section is not missing', () => {
    expect(blockBadgeLabelKeys('verified', true)).toEqual(['verify.conflict']);
  });

  it('labels an exam overlap in the danger group, before a change, and lists both', () => {
    expect(blockBadgeLabelKeys('changed', false, true)).toEqual([
      'verify.examOverlap',
      'verify.changed',
    ]);
  });

  it('is empty for a verified section with no state', () => {
    expect(blockBadgeLabelKeys('verified', false)).toEqual([]);
  });
});
