import { describe, expect, it } from 'vitest';
import type { ClientRect } from '@dnd-kit/core';
import { activatorCoordinates, snapDragCardToCursor } from './snapToCursor';

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
