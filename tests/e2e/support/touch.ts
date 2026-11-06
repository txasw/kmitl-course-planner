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

/** A finger on the screen, moved and lifted step by step, so a spec can read the page
 * while the finger is still down. */
export interface HeldTouch {
  /** Move the finger to a point through a number of intermediate moves. */
  moveTo: (to: Point, steps: number) => Promise<void>;
  /** Lift the finger and end the touch session. */
  lift: () => Promise<void>;
}

/** Put a finger down on one point and keep it there until the spec lifts it. */
export async function touchDown(page: Page, from: Point): Promise<HeldTouch> {
  const cdp = await page.context().newCDPSession(page);
  let at = from;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [from],
  });
  return {
    moveTo: async (to, steps) => {
      const start = at;
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: start.x + (to.x - start.x) * progress,
              y: start.y + (to.y - start.y) * progress,
            },
          ],
        });
      }
      at = to;
    },
    lift: async () => {
      try {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
      } finally {
        await cdp.detach();
      }
    },
  };
}

async function performGesture(page: Page, gesture: Gesture): Promise<void> {
  const { from, to, holdMs, steps } = gesture;
  const finger = await touchDown(page, from);
  try {
    if (holdMs > 0) {
      // A long press is defined by elapsed time, so this wait is the gesture itself
      // rather than a wait for the page to settle.
      await page.waitForTimeout(holdMs);
    }
    await finger.moveTo(to, steps);
  } finally {
    // Lifting also detaches the session, so a failed move never leaves a finger down.
    await finger.lift();
  }
}

/** Touch one point and lift at once, as a tap does. */
export async function tap(page: Page, point: Point): Promise<void> {
  await performGesture(page, { from: point, to: point, holdMs: 0, steps: 0 });
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
