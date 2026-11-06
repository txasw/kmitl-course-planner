import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { useFocusTrap } from '@/features/shell/useFocusTrap';
import { installViewport } from '../../tests/support/viewport';
import { swipe } from '../../tests/support/swipe';
import { BottomSheet } from './BottomSheet';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The overlay shape: a trapped panel that is also the portal root, with the sheet opened
// from inside a live region, the way a strip or banner could open one. It can also mount
// with the sheet already shown, the way the panel opens straight at a sheet, so the sheet
// renders before its portal root exists.
function Panel({
  onOverlayEscape,
  footer,
  initiallyOpen = false,
}: {
  onOverlayEscape: () => void;
  footer?: boolean;
  initiallyOpen?: boolean;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(initiallyOpen);
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
            <BottomSheet
              title="Sheet title"
              closeLabel="Close"
              onClose={() => {
                setOpen(false);
              }}
              footer={
                footer === true ? <button type="button">Act</button> : undefined
              }
            >
              <p>Body text</p>
              <button type="button">Body action</button>
            </BottomSheet>
          ) : null}
        </div>
      </PanelPortalContext.Provider>
    </div>
  );
}

function openSheet(props: { footer?: boolean } = {}) {
  const onOverlayEscape = vi.fn();
  render(<Panel onOverlayEscape={onOverlayEscape} {...props} />);
  const opener = screen.getByRole('button', { name: 'open' });
  opener.focus();
  fireEvent.click(opener);
  return { opener, onOverlayEscape };
}

describe('BottomSheet', () => {
  it('is a modal dialog named by its heading', () => {
    openSheet();
    const dialog = screen.getByRole('dialog', { name: 'Sheet title' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus to the heading on open', () => {
    openSheet();
    expect(screen.getByRole('heading', { name: 'Sheet title' })).toHaveFocus();
  });

  it('takes focus and Escape when it mounts before its portal root', () => {
    const onOverlayEscape = vi.fn();
    render(<Panel onOverlayEscape={onOverlayEscape} initiallyOpen />);
    expect(screen.getByRole('heading', { name: 'Sheet title' })).toHaveFocus();
    screen.getByRole('button', { name: 'Body action' }).focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOverlayEscape).not.toHaveBeenCalled();
  });

  it('closes on Escape while the overlay stays open', () => {
    const { onOverlayEscape } = openSheet();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Body action' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOverlayEscape).not.toHaveBeenCalled();
  });

  it('returns focus to the opener on close', () => {
    const { opener } = openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('never mounts inside the live region it was opened from', () => {
    openSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('[aria-live]')).toBeNull();
    expect(screen.getByTestId('panel')).toContainElement(dialog);
  });

  it('wraps Tab inside the sheet', () => {
    openSheet({ footer: true });
    screen.getByRole('button', { name: 'Act' }).focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('keeps Shift+Tab from the focused heading inside the sheet', () => {
    openSheet();
    const heading = screen.getByRole('heading', { name: 'Sheet title' });
    expect(heading).toHaveFocus();
    fireEvent.keyDown(heading, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Body action' })).toHaveFocus();
  });

  it('closes from the scrim, which is neither a tab stop nor announced', () => {
    openSheet();
    const scrim = screen
      .getByRole('dialog')
      .parentElement?.querySelector('button[aria-hidden="true"]');
    if (scrim === null || scrim === undefined) throw new Error('no scrim');
    expect(scrim).toHaveAttribute('tabindex', '-1');
    fireEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pins the footer below the scrolling body', () => {
    openSheet({ footer: true });
    const body = screen.getByText('Body text').parentElement;
    const footer = screen.getByRole('button', { name: 'Act' }).parentElement;
    expect(body).toHaveClass('overflow-y-auto', 'min-h-0', 'flex-1');
    expect(footer).toHaveClass('shrink-0');
    expect(screen.getByRole('dialog')).toHaveClass('max-h-[85dvh]');
  });

  it('closes on a downward swipe on the header', () => {
    openSheet();
    swipe(screen.getByRole('heading', { name: 'Sheet title' }), 'y', 120);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays open after an upward or short swipe on the header', () => {
    openSheet();
    const heading = screen.getByRole('heading', { name: 'Sheet title' });
    swipe(heading, 'y', -120);
    swipe(heading, 'y', 30);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('leaves a swipe in the body to the browser so it scrolls', () => {
    openSheet();
    swipe(screen.getByText('Body text'), 'y', 120);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('rises in with motion and appears in place under reduced motion', () => {
    openSheet();
    expect(screen.getByRole('dialog')).toHaveClass('kcp-sheet-enter');
    cleanup();
    installViewport(390, { reducedMotion: true });
    openSheet();
    expect(screen.getByRole('dialog')).not.toHaveClass('kcp-sheet-enter');
    // Without motion nothing tracks the pointer, so the swipe does not close it.
    swipe(screen.getByRole('heading', { name: 'Sheet title' }), 'y', 120);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fills the viewport and focuses the named control when asked', () => {
    function FullSheet() {
      const actRef = useRef<HTMLButtonElement>(null);
      return (
        <PanelPortalContext.Provider value={document.body}>
          <BottomSheet
            title="Review"
            closeLabel="Close"
            onClose={vi.fn()}
            fullHeight
            initialFocusRef={actRef}
            footer={
              <button ref={actRef} type="button">
                Act
              </button>
            }
          >
            <p>Body text</p>
          </BottomSheet>
        </PanelPortalContext.Provider>
      );
    }
    render(<FullSheet />);
    expect(screen.getByRole('button', { name: 'Act' })).toHaveFocus();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('h-dvh');
    expect(dialog).not.toHaveClass('max-h-[85dvh]');
  });
});
