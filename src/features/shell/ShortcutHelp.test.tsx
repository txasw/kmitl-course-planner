import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { installViewport } from '../../../tests/support/viewport';
import { PanelPortalContext } from './PanelPortalContext';
import { DEFAULT_SHELL_CHROME, ShellChromeContext } from './ShellChromeContext';
import { ShortcutHelp } from './ShortcutHelp';
import { uiStore } from './uiStore';

function renderHelp(onClose: () => void): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <PanelPortalContext.Provider value={root}>
      <ShortcutHelp onClose={onClose} />
    </PanelPortalContext.Provider>,
  );
  return root;
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().setLanguage('th');
  });
});

describe('ShortcutHelp', () => {
  it('lists each shortcut with its keys', () => {
    installViewport(1366);
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    renderHelp(() => undefined);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).not.toHaveClass('rounded-t-kcp-sheet');
    const terms = screen.getAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual([
      '/',
      'CtrlZorCmdZ',
      '?',
      'Esc',
    ]);
    expect(screen.getByText('Go to the results filter')).toBeInTheDocument();
    expect(
      screen.getByText('Shortcuts do not apply while you type in a field.'),
    ).toBeInTheDocument();
  });

  it('describes Escape with the line the chrome gives', () => {
    installViewport(1366);
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    const root = document.createElement('div');
    document.body.append(root);
    render(
      <ShellChromeContext.Provider
        value={{ ...DEFAULT_SHELL_CHROME, escapeLine: 'tour.menu' }}
      >
        <PanelPortalContext.Provider value={root}>
          <ShortcutHelp onClose={() => undefined} />
        </PanelPortalContext.Provider>
      </ShellChromeContext.Provider>,
    );
    const rows = screen.getAllByRole('definition');
    expect(rows[rows.length - 1]).toHaveTextContent(/^Product tour$/);
    expect(
      screen.queryByText(
        'Close the open window, leave the export page, or close the panel',
      ),
    ).not.toBeInTheDocument();
  });

  it('has no serious accessibility violations', async () => {
    installViewport(1366);
    const root = renderHelp(() => undefined);
    await expectNoSeriousA11yViolations(root);
  });

  it('closes from its close control', () => {
    installViewport(1366);
    const onClose = vi.fn();
    renderHelp(onClose);
    fireEvent.click(screen.getByRole('button', { name: 'ปิดแป้นพิมพ์ลัด' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('is a bottom sheet below 640 px', () => {
    installViewport(390);
    renderHelp(() => undefined);
    expect(screen.getByRole('dialog', { name: 'แป้นพิมพ์ลัด' })).toHaveClass(
      'rounded-t-kcp-sheet',
    );
  });
});
