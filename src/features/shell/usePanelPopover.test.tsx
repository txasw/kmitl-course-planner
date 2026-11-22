import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { useCallback } from 'react';
import {
  PANEL_POPOVER_MAX_WIDTH,
  PANEL_POPOVER_SCROLL,
  panelPopoverMiddleware,
  usePanelPopover,
  type PanelColumn,
} from './usePanelPopover';

function Harness({
  anchor,
  column = null,
}: {
  anchor: HTMLElement;
  column?: PanelColumn | null;
}) {
  const { refs, floatingStyles } = usePanelPopover({
    gap: 4,
    open: true,
    placement: 'bottom-start',
    column,
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

// A column element at a given box; floating-ui reads its inner box from its bounding rect
// and its client size, and the column step reads its bounding rect.
function makeColumn(box: {
  top: number;
  height: number;
  width: number;
}): HTMLElement {
  const boundary = document.createElement('div');
  document.body.appendChild(boundary);
  boundary.getBoundingClientRect = () =>
    DOMRect.fromRect({
      x: 0,
      y: box.top,
      width: box.width,
      height: box.height,
    });
  Object.defineProperty(boundary, 'clientWidth', { value: box.width });
  Object.defineProperty(boundary, 'clientHeight', { value: box.height });
  return boundary;
}

async function renderAt(
  viewport: { width: number; height: number },
  column: PanelColumn | null = null,
) {
  stubViewport(viewport.width, viewport.height);
  const anchor = makeAnchor();
  stubAnchorBox(anchor, 100, 20);
  render(<Harness anchor={anchor} column={column} />);
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

  it('ends with the column step when a column is named', () => {
    const column = { area: document.createElement('div') };
    expect(panelPopoverMiddleware(6, column).map((item) => item.name)).toEqual([
      'offset',
      'flip',
      'shift',
      'size',
      'fillColumn',
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

  // A column from 50 to 400 px, as the plan area ends above the status row: the node takes
  // its full height and sits at its top, whatever the anchor's place, so neither edge lands
  // inside it, though the viewport runs to 600 px.
  it('stands the node as a column of the named element', async () => {
    const column = makeColumn({ top: 50, height: 350, width: 1024 });
    stubViewport(1024, 600);
    const anchor = makeAnchor();
    stubAnchorBox(anchor, 100, 20);
    render(<Harness anchor={anchor} column={{ area: column }} />);
    const node = screen.getByTestId('floating');
    await waitFor(() => {
      expect(node.style.height).toBe('350px');
    });
    expect(node.style.maxHeight).toBe('350px');
    expect(node.style.transform).toMatch(/translate\(\d+px, 50px\)/);
  });

  it('clips the column to the viewport', async () => {
    const column = makeColumn({ top: 50, height: 700, width: 1024 });
    const node = await renderAt({ width: 1024, height: 600 }, { area: column });
    await waitFor(() => {
      expect(node.style.height).toBe('550px');
    });
  });

  // The head, the timetable's pinned hour row, ends at 80 px: the node starts at its foot,
  // so its top lies on the head's rule and its side never splits an hour label.
  it('starts the column at the foot of its head', async () => {
    const column = makeColumn({ top: 50, height: 350, width: 1024 });
    const head = document.createElement('div');
    head.setAttribute('data-head', '');
    head.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 50, width: 1024, height: 30 });
    column.appendChild(head);
    const node = await renderAt(
      { width: 1024, height: 600 },
      { area: column, head: '[data-head]' },
    );
    await waitFor(() => {
      expect(node.style.height).toBe('320px');
    });
    expect(node.style.transform).toMatch(/translate\(\d+px, 80px\)/);
  });

  it('starts at the column top when no head matches', async () => {
    const column = makeColumn({ top: 50, height: 350, width: 1024 });
    const node = await renderAt(
      { width: 1024, height: 600 },
      { area: column, head: '[data-head]' },
    );
    await waitFor(() => {
      expect(node.style.height).toBe('350px');
    });
  });

  it('places the node again when the column resizes', async () => {
    const observed: Element[] = [];
    let fire: () => void = () => {
      /* set when the observer is built */
    };
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        fire = () => {
          callback([], this);
        };
      }
      observe(target: Element): void {
        observed.push(target);
      }
      unobserve(): void {
        /* nothing to release */
      }
      disconnect(): void {
        /* nothing to release */
      }
    };
    try {
      const box = { top: 50, height: 350, width: 1024 };
      const column = makeColumn(box);
      const node = await renderAt(
        { width: 1024, height: 600 },
        { area: column },
      );
      await waitFor(() => {
        expect(node.style.height).toBe('350px');
      });
      expect(observed).toContain(column);
      // The status row wraps onto another line, so the plan area ends 40 px higher.
      column.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 0, y: 50, width: 1024, height: 310 });
      fire();
      await waitFor(() => {
        expect(node.style.height).toBe('310px');
      });
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
