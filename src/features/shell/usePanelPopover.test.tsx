import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { useCallback } from 'react';
import {
  PANEL_POPOVER_MAX_WIDTH,
  PANEL_POPOVER_SCROLL,
  panelPopoverMiddleware,
  usePanelPopover,
} from './usePanelPopover';

function Harness({ anchor }: { anchor: HTMLElement }) {
  const { refs, floatingStyles } = usePanelPopover({
    gap: 4,
    open: true,
    placement: 'bottom-start',
    elements: { reference: anchor },
  });
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );
  return (
    <div
      ref={setFloating}
      data-testid="floating"
      style={floatingStyles}
      className={PANEL_POPOVER_SCROLL}
    />
  );
}

function makeAnchor(): HTMLElement {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  return anchor;
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('panelPopoverMiddleware', () => {
  it('composes offset, flip, shift and size in that order', () => {
    expect(panelPopoverMiddleware(6).map((item) => item.name)).toEqual([
      'offset',
      'flip',
      'shift',
      'size',
    ]);
  });
});

describe('usePanelPopover', () => {
  it('positions the floating node with the fixed strategy', async () => {
    render(<Harness anchor={makeAnchor()} />);
    const node = screen.getByTestId('floating');
    await waitFor(() => {
      expect(node.style.position).toBe('fixed');
    });
  });

  it('caps the width at the panel maximum or the available width', async () => {
    render(<Harness anchor={makeAnchor()} />);
    const node = screen.getByTestId('floating');
    await waitFor(() => {
      expect(node.style.maxWidth).toContain(PANEL_POPOVER_MAX_WIDTH);
    });
    expect(node.style.maxWidth).toMatch(/^min\(22rem, \d+px\)$/);
  });

  it('scrolls inside the capped node with the panel scrollbar', () => {
    render(<Harness anchor={makeAnchor()} />);
    const node = screen.getByTestId('floating');
    expect(node).toHaveClass('kcp-scroll', 'overflow-y-auto');
  });
});
