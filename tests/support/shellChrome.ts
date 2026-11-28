// A panel chrome with a version badge, for the shell component tests. The shared
// components never import a root's chrome, so their tests build the value set they
// render here; the extension's own chrome is checked beside the entry that mounts it.

import {
  DEFAULT_SHELL_CHROME,
  type ShellChrome,
} from '@/features/shell/ShellChromeContext';

export function versionBadgeChrome(version: string | null): ShellChrome {
  return {
    ...DEFAULT_SHELL_CHROME,
    badge:
      version === null
        ? null
        : {
            pill: 'header.versionTag',
            line: 'header.versionLine',
            phrase: 'header.version',
            values: { version },
          },
  };
}
