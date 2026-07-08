import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { Overlay } from './Overlay';
import { uiStore } from './uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';

const deps = fakeSearchDeps();

function wrapper({ children }: { children: ReactNode }) {
  return <SearchDepsProvider value={deps}>{children}</SearchDepsProvider>;
}

// Reduced motion makes the presence transitions instant, so open and close are
// deterministic in tests without advancing timers.
function stubReducedMotion() {
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
}

beforeEach(stubReducedMotion);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
});

describe('Overlay', () => {
  it('renders nothing while closed', () => {
    render(<Overlay />, { wrapper });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a labelled modal dialog when opened', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('ตัววางแผนตารางเรียน สจล.');
  });

  it('closes on Escape', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(uiStore.getState().isOpen).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the close control is activated', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Overlay />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('moves focus into the dialog and restores it on close', () => {
    render(
      <div>
        <button data-testid="opener">opener</button>
        <Overlay />
      </div>,
      { wrapper },
    );
    const opener = screen.getByTestId('opener');
    opener.focus();

    act(() => {
      uiStore.getState().open();
    });
    expect(screen.getByRole('dialog')).toHaveFocus();

    act(() => {
      uiStore.getState().close();
    });
    expect(opener).toHaveFocus();
  });
});
