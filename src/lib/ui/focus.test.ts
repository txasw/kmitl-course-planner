import { describe, it, expect } from 'vitest';
import { FOCUS_OUTLINE, FOCUS_RING } from './focus';

describe('focus constants', () => {
  it('restores the outline style that outline-none zeroes, so the outline paints', () => {
    // Tailwind v4 outline-none sets --tw-outline-style to none and the width utility draws
    // in that style, so without a focus-visible style the outline is invisible.
    const classes = FOCUS_OUTLINE.split(' ');
    expect(classes).toContain('outline-none');
    expect(classes).toContain('focus-visible:outline-solid');
  });

  it('draws the ring inset so a clipping ancestor cannot truncate it', () => {
    expect(FOCUS_RING.split(' ')).toContain('focus-visible:ring-inset');
  });
});
