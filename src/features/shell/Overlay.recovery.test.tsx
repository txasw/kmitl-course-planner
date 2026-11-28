import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { Overlay } from './Overlay';
import {
  DEFAULT_SHELL_CHROME,
  ShellChromeContext,
  type ShellChrome,
} from './ShellChromeContext';
import { uiStore } from './uiStore';

// The panel body throws on render, so the boundary inside the overlay shows the
// recovery card and the test reads the sentence the overlay hands it from the chrome.
vi.mock('./Layout', () => ({
  Layout: () => {
    throw new Error('boom');
  },
}));

const t = createTranslator('th');
const deps = fakeSearchDeps();

function renderOverlay(chrome: ShellChrome | null): void {
  function wrapper({ children }: { children: ReactNode }) {
    const body = (
      <SearchDepsProvider value={deps}>{children}</SearchDepsProvider>
    );
    return chrome === null ? (
      body
    ) : (
      <ShellChromeContext.Provider value={chrome}>
        {body}
      </ShellChromeContext.Provider>
    );
  }
  // React logs the caught render error; silence it for the render and restore it after.
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    render(<Overlay />, { wrapper });
  } finally {
    spy.mockRestore();
  }
}

beforeEach(() => {
  installViewport(1440, { reducedMotion: true });
  act(() => {
    uiStore.getState().open();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
  });
});

describe('Overlay recovery card', () => {
  it('shows the panel error sentence when no root gives a chrome', () => {
    renderOverlay(null);
    expect(screen.getByRole('alert')).toHaveTextContent(t('panel.error.body'));
  });

  it('shows the error sentence the chrome gives in place of the default', () => {
    // A stand in key whose text is known, to show the overlay passes the chrome's
    // sentence through rather than a fixed one.
    renderOverlay({ ...DEFAULT_SHELL_CHROME, errorBody: 'shortcuts.note' });
    const card = screen.getByRole('alert');
    expect(card).toHaveTextContent(t('shortcuts.note'));
    expect(card).not.toHaveTextContent(t('panel.error.body'));
  });
});
