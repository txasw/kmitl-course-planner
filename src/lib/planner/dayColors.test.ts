import { describe, it, expect } from 'vitest';
import { contrastRatio } from '../../../tests/support/contrast';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { dayTint } from './dayColors';

// --kcp-ink, the label text color on the accented template day rows. The tint must keep
// the ink label well clear of WCAG AA for normal text, since a poster is read at a glance.
const INK = '#1a1a1a';
const AA_NORMAL = 4.5;

describe('Thai day color tints', () => {
  it('keeps ink label text AA legible on every day tint', () => {
    for (const day of WEEK_DAYS) {
      expect(contrastRatio(INK, dayTint(day))).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    }
  });

  it('produces an opaque six digit hex per day', () => {
    for (const day of WEEK_DAYS) {
      expect(dayTint(day)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('gives each weekday a distinct tint', () => {
    const tints = WEEK_DAYS.map((day) => dayTint(day));
    expect(new Set(tints).size).toBe(tints.length);
  });

  it('is deterministic across calls', () => {
    expect(dayTint(4)).toBe(dayTint(4));
  });
});
