import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createRef } from 'react';
import { PanelFrame } from './PanelFrame';
import { ShellChromeContext, DEFAULT_SHELL_CHROME } from './ShellChromeContext';
import { uiStore } from './uiStore';
import { OVERLAY_HISTORY_MARKER } from './useBackToClose';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';

// The frame a root wraps: without a wrapping overlay it is a plain region of the page,
// so a root that is the page itself shows the panel with no dialog, trap, or lock.

const deps = fakeSearchDeps();

function renderFrame(active = true) {
  const nodeRef = createRef<HTMLDivElement>();
  const view = render(
    <ShellChromeContext.Provider
      value={{ ...DEFAULT_SHELL_CHROME, onClose: null }}
    >
      <SearchDepsProvider value={deps}>
        <PanelFrame
          titleId="frame-title"
          active={active}
          nodeRef={nodeRef}
          className="page-frame"
        >
          <p>hosted layer</p>
        </PanelFrame>
      </SearchDepsProvider>
    </ShellChromeContext.Provider>,
  );
  return { ...view, nodeRef };
}

function holdsHelpEntry(): boolean {
  const state: unknown = window.history.state;
  return (
    typeof state === 'object' &&
    state !== null &&
    OVERLAY_HISTORY_MARKER in state
  );
}

afterEach(async () => {
  cleanup();
  act(() => {
    uiStore.getState().setLanguage('th');
  });
  // The shortcut help holds a history entry while open, and its unmount goes back
  // through a queued traversal; wait for it so no test starts on a moving history.
  while (holdsHelpEntry()) {
    await new Promise((resolve) => {
      window.addEventListener('popstate', resolve, { once: true });
    });
  }
});

describe('PanelFrame', () => {
  it('renders one main region under a header titled by the given id', () => {
    const { nodeRef } = renderFrame();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(document.getElementById('frame-title')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(nodeRef.current).toHaveClass('page-frame');
    expect(nodeRef.current).toContainElement(screen.getByText('hosted layer'));
  });

  it('carries the panel language on its node', () => {
    const { nodeRef } = renderFrame();
    expect(nodeRef.current).toHaveAttribute('lang', 'th');
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(nodeRef.current).toHaveAttribute('lang', 'en');
  });

  it('shows no close control when the chrome gives none', () => {
    renderFrame();
    expect(
      screen.queryByRole('button', { name: 'ปิด' }),
    ).not.toBeInTheDocument();
  });

  it('opens the shortcut help only while active', () => {
    const { nodeRef, rerender } = renderFrame(false);
    const node = nodeRef.current;
    if (node === null) throw new Error('the frame node is not attached');
    fireEvent.keyDown(node, { key: '?', code: 'Slash', shiftKey: true });
    expect(
      screen.queryByRole('dialog', { name: 'แป้นพิมพ์ลัด' }),
    ).not.toBeInTheDocument();
    rerender(
      <ShellChromeContext.Provider
        value={{ ...DEFAULT_SHELL_CHROME, onClose: null }}
      >
        <SearchDepsProvider value={deps}>
          <PanelFrame
            titleId="frame-title"
            active
            nodeRef={nodeRef}
            className="page-frame"
          />
        </SearchDepsProvider>
      </ShellChromeContext.Provider>,
    );
    fireEvent.keyDown(node, { key: '?', code: 'Slash', shiftKey: true });
    expect(
      screen.getByRole('dialog', { name: 'แป้นพิมพ์ลัด' }),
    ).toBeInTheDocument();
  });
});
