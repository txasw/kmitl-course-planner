// Touch gestures for the phone and tablet projects. Playwright offers only
// touchscreen.tap, so a long press, a touch drag, and a swipe are sent as raw
// touch events over the Chrome DevTools Protocol. This is Chromium only, which
// matches the extension context the fixtures launch. Points are CSS pixels in the
// page viewport, the same space as a locator bounding box.

import type { Page } from '@playwright/test';

export interface Point {
  x: number;
  y: number;
}

/** A hold past the half second that touch long press handlers commonly wait for. */
export const LONG_PRESS_MS = 600;

interface Gesture {
  from: Point;
  to: Point;
  /** Time the finger rests at the start point before it moves. */
  holdMs: number;
  /** Number of intermediate moves from the start point to the end point. */
  steps: number;
}

async function performGesture(page: Page, gesture: Gesture): Promise<void> {
  const { from, to, holdMs, steps } = gesture;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [from],
    });
    if (holdMs > 0) {
      // A long press is defined by elapsed time, so this wait is the gesture
      // itself rather than a wait for the page to settle.
      await page.waitForTimeout(holdMs);
    }
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: from.x + (to.x - from.x) * progress,
            y: from.y + (to.y - from.y) * progress,
          },
        ],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
}

/** Press and hold one point without moving, then lift. */
export async function longPress(
  page: Page,
  point: Point,
  holdMs: number = LONG_PRESS_MS,
): Promise<void> {
  await performGesture(page, { from: point, to: point, holdMs, steps: 0 });
}

/** Long press a point, then drag the held finger to another point and lift. */
export async function touchDrag(
  page: Page,
  from: Point,
  to: Point,
  steps = 12,
): Promise<void> {
  await performGesture(page, { from, to, holdMs: LONG_PRESS_MS, steps });
}

/** Move a finger from one point to another without a hold, as a scroll does. */
export async function swipe(
  page: Page,
  from: Point,
  to: Point,
  steps = 8,
): Promise<void> {
  await performGesture(page, { from, to, holdMs: 0, steps });
}
