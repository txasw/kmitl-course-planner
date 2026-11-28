import { createContext, useContext } from 'react';
import type { TranslationKey } from '@/lib/i18n/t';
import type { TemplateValues } from '@/lib/i18n/template';
import { uiStore } from './uiStore';

// The panel chrome as resolved data: what the header brand and its overflow menu show
// as a badge, whether the header carries a close control, what the panel error card
// says, and how the shortcut help describes Escape. The root that mounts the panel
// provides it, so the shared components render what they are given and never ask which
// build they run in. The default is the panel without a badge, with the close action,
// and with the panel's own error and Escape copy, which is what a panel rendered without
// a provider has always shown.

/** The badge on the header brand mark, repeated by the overflow menu below 640 px. */
export interface ShellBadge {
  /** The quiet pill on the brand mark, hidden from the accessibility tree. */
  pill: TranslationKey;
  /** The muted line under the overflow menu below 640 px, also hidden from it. */
  line: TranslationKey;
  /** The phrase a screen reader reads in place of the pill and the line. */
  phrase: TranslationKey;
  /** The values the three keys fill. */
  values: TemplateValues;
}

export interface ShellChrome {
  /** Null shows the bare brand mark and no badge line. */
  badge: ShellBadge | null;
  /** Null leaves the header without a close control. */
  onClose: (() => void) | null;
  /** The sentence the panel error card shows under its title. */
  errorBody: TranslationKey;
  /** What the shortcut help says Escape does. */
  escapeLine: TranslationKey;
}

export const DEFAULT_SHELL_CHROME: ShellChrome = {
  badge: null,
  onClose: () => {
    uiStore.getState().close();
  },
  errorBody: 'panel.error.body',
  escapeLine: 'shortcuts.escape',
};

export const ShellChromeContext =
  createContext<ShellChrome>(DEFAULT_SHELL_CHROME);

export function useShellChrome(): ShellChrome {
  return useContext(ShellChromeContext);
}
