import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Overlay } from './Overlay';
import { Launcher } from './Launcher';
import { uiStore } from './uiStore';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';

// Reduced motion mounts the overlay instantly so axe scans the final markup.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
});

describe('shell accessibility', () => {
  it('the launcher has no serious violations', async () => {
    const { container } = render(<Launcher />);
    await expectNoSeriousA11yViolations(container);
  });

  it('the open overlay has no serious violations', async () => {
    act(() => {
      uiStore.getState().open();
    });
    const { container } = render(<Overlay />);
    await expectNoSeriousA11yViolations(container);
  });

  it('the overlay with the catalog drawer open has no serious violations', async () => {
    act(() => {
      uiStore.getState().open();
      uiStore.getState().setDrawer(true);
    });
    const { container } = render(<Overlay />);
    await expectNoSeriousA11yViolations(container);
  });
});
