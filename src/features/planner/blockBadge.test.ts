import { describe, it, expect } from 'vitest';
import { blockBadge, blockBadgeLabelKey } from './blockBadge';

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

  it('is null for a verified section with no conflict', () => {
    expect(blockBadge('verified', false)).toBeNull();
    expect(blockBadge('unverified', false)).toBeNull();
  });

  it('labels missing before a conflict', () => {
    expect(blockBadgeLabelKey('missing', true)).toBe('verify.missing');
  });

  it('labels a conflict when the section is not missing', () => {
    expect(blockBadgeLabelKey('verified', true)).toBe('verify.conflict');
  });

  it('labels a change when nothing worse applies', () => {
    expect(blockBadgeLabelKey('changed', false)).toBe('verify.changed');
    expect(blockBadgeLabelKey('verified', false)).toBeNull();
  });
});
