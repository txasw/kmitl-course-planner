import { describe, expect, it } from 'vitest';
import { formatShortcut, SHORTCUT_MAX_LENGTH } from './shortcut';

describe('formatShortcut', () => {
  it('keeps a shortcut that is already in words', () => {
    expect(formatShortcut('Alt+Shift+P')).toBe('Alt+Shift+P');
    expect(formatShortcut('Ctrl+Shift+Comma')).toBe('Ctrl+Shift+Comma');
  });

  it('spells out the macOS modifier symbols', () => {
    expect(formatShortcut('⇧⌥P')).toBe('Shift+Option+P');
    expect(formatShortcut('⌘⌃K')).toBe('Command+Ctrl+K');
  });

  it('spells out arrow key symbols', () => {
    expect(formatShortcut('⌥↑')).toBe('Option+Up');
  });

  it('names MacCtrl as Ctrl', () => {
    expect(formatShortcut('MacCtrl+Shift+P')).toBe('Ctrl+Shift+P');
  });

  it('is null for an absent, empty or blank value', () => {
    expect(formatShortcut(null)).toBeNull();
    expect(formatShortcut('')).toBeNull();
    expect(formatShortcut(' + ')).toBeNull();
  });

  it('is null for an overlong value', () => {
    expect(formatShortcut('A'.repeat(60))).toBeNull();
    expect(formatShortcut('A'.repeat(SHORTCUT_MAX_LENGTH))).toBe(
      'A'.repeat(SHORTCUT_MAX_LENGTH),
    );
  });

  it('is null for a key it cannot spell in plain text', () => {
    expect(formatShortcut('Alt+ก')).toBeNull();
    expect(formatShortcut('⎋P')).toBeNull();
  });
});
