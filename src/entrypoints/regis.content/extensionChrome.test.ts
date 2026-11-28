import { describe, it, expect } from 'vitest';
import { DEFAULT_SHELL_CHROME } from '@/features/shell/ShellChromeContext';
import { createTranslator, type Locale } from '@/lib/i18n/t';
import { templateTokens } from '@/lib/i18n/template';
import { extensionChrome } from './extensionChrome';

const LOCALES: readonly Locale[] = ['th', 'en'];

describe('extensionChrome', () => {
  it('shows the loaded version as the badge', () => {
    expect(extensionChrome('1.5.0').badge).toEqual({
      pill: 'header.versionTag',
      line: 'header.versionLine',
      phrase: 'header.version',
      values: { version: '1.5.0' },
    });
  });

  it('shows no badge when the version is unreadable', () => {
    expect(extensionChrome(null).badge).toBeNull();
  });

  it('keeps the panel close action, error sentence, and Escape line', () => {
    const chrome = extensionChrome('1.5.0');
    expect(chrome.onClose).toBe(DEFAULT_SHELL_CHROME.onClose);
    expect(chrome.errorBody).toBe(DEFAULT_SHELL_CHROME.errorBody);
    expect(chrome.escapeLine).toBe(DEFAULT_SHELL_CHROME.escapeLine);
  });

  // The badge type does not tie its keys to their placeholders, so this checks that
  // every placeholder the three keys use in either language has a value, and no raw
  // token can reach the pill, the line, or the screen reader phrase.
  it('fills every placeholder of its badge keys in both languages', () => {
    const badge = extensionChrome('1.5.0').badge;
    expect(badge).not.toBeNull();
    if (badge === null) return;
    const named = Object.keys(badge.values);
    for (const locale of LOCALES) {
      const t = createTranslator(locale);
      for (const key of [badge.pill, badge.line, badge.phrase]) {
        for (const token of templateTokens(t(key))) {
          expect(named).toContain(token);
        }
      }
    }
  });
});
