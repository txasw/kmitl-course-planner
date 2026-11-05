import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { useFocusTrap } from '@/features/shell/useFocusTrap';
import { ModalDialog } from './ModalDialog';

afterEach(() => {
  cleanup();
});

// The overlay shape: a trapped panel that is also the portal root, with the dialog opened
// from inside a live region.
function Panel({ onOverlayEscape }: { onOverlayEscape: () => void }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  useFocusTrap(panelRef, true, onOverlayEscape);
  return (
    <div
      ref={(element) => {
        panelRef.current = element;
        setNode(element);
      }}
      tabIndex={-1}
      data-testid="panel"
    >
      <PanelPortalContext.Provider value={node}>
        <div aria-live="polite">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            open
          </button>
          {open ? (
            <ModalDialog
              title="Dialog title"
              closeLabel="Close"
              onClose={() => {
                setOpen(false);
              }}
            >
              <button type="button">Body action</button>
            </ModalDialog>
          ) : null}
        </div>
      </PanelPortalContext.Provider>
    </div>
  );
}

function openDialog() {
  const onOverlayEscape = vi.fn();
  render(<Panel onOverlayEscape={onOverlayEscape} />);
  const opener = screen.getByRole('button', { name: 'open' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, onOverlayEscape };
}

describe('ModalDialog', () => {
  it('is a modal dialog named by its heading, which takes focus', () => {
    openDialog();
    const dialog = screen.getByRole('dialog', { name: 'Dialog title' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Dialog title' })).toHaveFocus();
    expect(dialog.closest('[aria-live]')).toBeNull();
    expect(screen.getByTestId('panel')).toContainElement(dialog);
  });

  it('closes on Escape while the overlay stays open', () => {
    const { onOverlayEscape } = openDialog();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Body action' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOverlayEscape).not.toHaveBeenCalled();
  });

  it('wraps Tab inside the dialog', () => {
    openDialog();
    screen.getByRole('button', { name: 'Body action' }).focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('returns focus to the opener on close', () => {
    const { opener } = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('closes from the scrim, which is neither a tab stop nor announced', () => {
    openDialog();
    const scrim = screen
      .getByRole('dialog')
      .parentElement?.querySelector('button[aria-hidden="true"]');
    if (scrim === null || scrim === undefined) throw new Error('no scrim');
    expect(scrim).toHaveAttribute('tabindex', '-1');
    fireEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
