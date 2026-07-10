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

  it('is warn for an exam overlapping section', () => {
    expect(blockBadge('verified', false, true)).toBe('warn');
  });

  it('lets danger win over an exam warn on the same block', () => {
    expect(blockBadge('verified', true, true)).toBe('danger');
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

  it('labels an exam overlap distinct from a change and lists both', () => {
    expect(blockBadgeLabelKeys('changed', false, true)).toEqual([
      'verify.changed',
      'verify.examOverlap',
    ]);
  });

  it('is empty for a verified section with no state', () => {
    expect(blockBadgeLabelKeys('verified', false)).toEqual([]);
  });
});
