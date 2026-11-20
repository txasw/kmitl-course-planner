import { describe, expect, it } from 'vitest';
import type { ClientRect } from '@dnd-kit/core';
import {
  activatorCoordinates,
  keepOverlayInWindow,
  OVERLAY_EDGE_GAP,
  snapDragCardToCursor,
  TOUCH_LIFT_GAP,
} from './snapToCursor';

function rect(left: number, top: number): ClientRect {
  return {
    left,
    top,
    right: left + 40,
    bottom: top + 20,
    width: 40,
    height: 20,
  };
}

const IDENTITY = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

/** A touch start at one point. jsdom has no Touch constructor, so the touch list is a
 * plain array of the two fields the modifier reads. */
function touchStart(clientX: number, clientY: number): Event {
  return Object.assign(new Event('touchstart'), {
    touches: [{ clientX, clientY }],
    changedTouches: [],
  });
}

// The modifier receives the full dnd-kit argument object; only the activator event,
// the dragging node rect, and the transform drive the result, so the rest are the
// inert defaults dnd-kit would pass before anything is measured.
function args(overrides: {
  activatorEvent: Event | null;
  draggingNodeRect: ClientRect | null;
  transform: { x: number; y: number; scaleX: number; scaleY: number };
}) {
  return {
    active: null,
    activeNodeRect: null,
    containerNodeRect: null,
    over: null,
    overlayNodeRect: null,
    scrollableAncestors: [],
    scrollableAncestorRects: [],
    windowRect: null,
    ...overrides,
  };
}

describe('activatorCoordinates', () => {
  it('reads client coordinates from a pointer event', () => {
    const event = new MouseEvent('pointerdown', { clientX: 120, clientY: 80 });
    expect(activatorCoordinates(event)).toEqual({ x: 120, y: 80 });
  });

  it('reads client coordinates from the first touch of a touch start', () => {
    expect(activatorCoordinates(touchStart(64, 48))).toEqual({ x: 64, y: 48 });
  });

  it('returns null for a touch event that carries no touch', () => {
    const empty = Object.assign(new Event('touchstart'), {
      touches: [],
      changedTouches: [],
    });
    expect(activatorCoordinates(empty)).toBeNull();
  });

  it('returns null when there is no event', () => {
    expect(activatorCoordinates(null)).toBeNull();
  });
});

describe('snapDragCardToCursor', () => {
  it('shifts the transform so the node top-left lands on the pointer', () => {
    const event = new MouseEvent('pointerdown', { clientX: 300, clientY: 200 });
    const result = snapDragCardToCursor(
      args({
        activatorEvent: event,
        draggingNodeRect: rect(100, 60),
        transform: IDENTITY,
      }),
    );
    // pointer 300,200 minus node top-left 100,60 offsets the identity transform.
    expect(result).toEqual({ x: 200, y: 140, scaleX: 1, scaleY: 1 });
  });

  it('preserves an existing pointer delta while re-anchoring', () => {
    const event = new MouseEvent('pointerdown', { clientX: 300, clientY: 200 });
    const result = snapDragCardToCursor(
      args({
        activatorEvent: event,
        draggingNodeRect: rect(100, 60),
        transform: { x: 25, y: 10, scaleX: 1, scaleY: 1 },
      }),
    );
    expect(result).toEqual({ x: 225, y: 150, scaleX: 1, scaleY: 1 });
  });

  it('passes the transform through when the node is not measured yet', () => {
    const event = new MouseEvent('pointerdown', { clientX: 300, clientY: 200 });
    const transform = { x: 5, y: 6, scaleX: 1, scaleY: 1 };
    expect(
      snapDragCardToCursor(
        args({ activatorEvent: event, draggingNodeRect: null, transform }),
      ),
    ).toBe(transform);
  });

  it('passes the transform through when there is no activator event', () => {
    const transform = { x: 5, y: 6, scaleX: 1, scaleY: 1 };
    expect(
      snapDragCardToCursor(
        args({
          activatorEvent: null,
          draggingNodeRect: rect(100, 60),
          transform,
        }),
      ),
    ).toBe(transform);
  });
});

describe('keepOverlayInWindow', () => {
  const windowRect: ClientRect = {
    left: 0,
    top: 0,
    right: 360,
    bottom: 800,
    width: 360,
    height: 800,
  };
  const WIDTH = 240;
  const HEIGHT = 90;

  /** The overlay content box dnd-kit measures, at left 100 and top 300. */
  const content: ClientRect = {
    left: 100,
    top: 300,
    right: 100 + WIDTH,
    bottom: 300 + HEIGHT,
    width: WIDTH,
    height: HEIGHT,
  };

  function place(
    transform: { x: number; y: number; scaleX: number; scaleY: number },
    touchLift = false,
    draggingNodeRect: ClientRect | null = content,
  ) {
    return keepOverlayInWindow(touchLift)({
      ...args({ activatorEvent: null, draggingNodeRect, transform }),
      windowRect,
    });
  }

  /** The visible box after the modifier, as left, top, right, and bottom. */
  function box(transform: { x: number; y: number }) {
    const left = content.left + transform.x;
    const top = content.top + transform.y;
    return { left, top, right: left + WIDTH, bottom: top + HEIGHT };
  }

  it('leaves an overlay that fits the window where it is', () => {
    expect(place({ x: 10, y: 20, scaleX: 1, scaleY: 1 })).toEqual({
      x: 10,
      y: 20,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('slides an overlay back from the right and bottom edges', () => {
    // At left 330 and top 780 the 240 by 90 content would run past 360 and 800.
    const result = box(place({ x: 230, y: 480, scaleX: 1, scaleY: 1 }));
    expect(result.right).toBe(360 - OVERLAY_EDGE_GAP);
    expect(result.bottom).toBe(800 - OVERLAY_EDGE_GAP);
  });

  it('keeps the overlay off the left and top edges', () => {
    const result = box(place({ x: -150, y: -350, scaleX: 1, scaleY: 1 }));
    expect(result.left).toBe(OVERLAY_EDGE_GAP);
    expect(result.top).toBe(OVERLAY_EDGE_GAP);
  });

  it('lifts a touch overlay above the finger and centres it on the touch point', () => {
    // The snap puts the content's top-left at the finger, here at 180 by 400.
    const result = box(place({ x: 80, y: 100, scaleX: 1, scaleY: 1 }, true));
    expect(result.left).toBe(180 - WIDTH / 2);
    expect(result.bottom).toBe(400 - TOUCH_LIFT_GAP);
  });

  it('keeps a lifted touch overlay inside the left edge', () => {
    // A finger at x 20 would centre the 240 wide card from x -100.
    const result = box(place({ x: -80, y: 100, scaleX: 1, scaleY: 1 }, true));
    expect(result.left).toBe(OVERLAY_EDGE_GAP);
    expect(result.bottom).toBe(400 - TOUCH_LIFT_GAP);
  });

  it('keeps a lifted touch overlay inside the right edge, no further from the finger', () => {
    // A finger at x 340 would centre the card to x 460, past the 360 edge.
    const result = box(place({ x: 240, y: 100, scaleX: 1, scaleY: 1 }, true));
    expect(result.right).toBe(360 - OVERLAY_EDGE_GAP);
  });

  it('keeps a lifted touch overlay below the top edge', () => {
    // A finger at y 60 would lift the 90 tall card to y -62.
    const result = box(place({ x: 80, y: -240, scaleX: 1, scaleY: 1 }, true));
    expect(result.top).toBe(OVERLAY_EDGE_GAP);
  });

  it('keeps a lifted touch overlay above the bottom edge', () => {
    // A finger past the window foot still leaves the card whole above the edge.
    const result = box(place({ x: 80, y: 700, scaleX: 1, scaleY: 1 }, true));
    expect(result.bottom).toBe(800 - OVERLAY_EDGE_GAP);
  });

  it('passes the transform through before the content is measured', () => {
    const transform = { x: 230, y: 700, scaleX: 1, scaleY: 1 };
    expect(place(transform, true, null)).toBe(transform);
  });
});
