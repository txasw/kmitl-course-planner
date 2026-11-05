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

// jsdom lays nothing out, so the viewport and the anchor box are stubbed: floating-ui
// reads the viewport from the document element's client size and the anchor from its
// bounding rect.
function stubViewport(width: number, height: number): void {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

function stubAnchorBox(anchor: HTMLElement, top: number, height: number): void {
  anchor.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: 16, y: top, width: 80, height });
}

async function renderAt(viewport: { width: number; height: number }) {
  stubViewport(viewport.width, viewport.height);
  const anchor = makeAnchor();
  stubAnchorBox(anchor, 100, 20);
  render(<Harness anchor={anchor} />);
  const node = screen.getByTestId('floating');
  await waitFor(() => {
    expect(node.style.maxHeight).not.toBe('');
  });
  return node;
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  Reflect.deleteProperty(document.documentElement, 'clientWidth');
  Reflect.deleteProperty(document.documentElement, 'clientHeight');
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

describe('usePanelPopover available space', () => {
  // The anchor ends at 120 px and the node sits 4 px below it, so the room left is the
  // viewport height less 124 px and the 8 px edge padding.
  it('sets the max height from the space left below the anchor', async () => {
    const node = await renderAt({ width: 1024, height: 600 });
    expect(node.style.maxHeight).toBe('468px');
  });

  it('shrinks the max height on a shorter viewport', async () => {
    const node = await renderAt({ width: 1024, height: 300 });
    expect(node.style.maxHeight).toBe('168px');
  });

  // Shift may slide the node along the anchor's edge, so the width it may take is the
  // viewport less the 8 px padding on both sides: 344 px on a 360 px phone, under 22rem.
  it('caps the width to the space left on a narrow viewport', async () => {
    const node = await renderAt({ width: 360, height: 600 });
    expect(node.style.maxWidth).toBe('min(22rem, 344px)');
  });
});
