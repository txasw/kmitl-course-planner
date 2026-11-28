import {
  DEFAULT_SHELL_CHROME,
  type ShellChrome,
} from '@/features/shell/ShellChromeContext';

// The extension's panel chrome: the panel default, which closes back to the host page,
// with the loaded version as the badge, or no badge when the version is unreadable.
export function extensionChrome(version: string | null): ShellChrome {
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
