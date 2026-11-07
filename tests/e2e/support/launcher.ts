// Where the launcher pill sits (ADR-0063). It keeps a 20 px offset from the right and
// bottom edges, or the device safe area inset where that is larger, and is a 44 px
// target at least. The insets are read from the host page through env(), so the check
// holds on a device that reports a notch as well as on one that reports none.

import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** The launcher's accessible name in the default locale. */
const LAUNCHER_NAME = 'เปิด KCP: Course Planner for KMITL';

const EDGE_OFFSET = 20;
const TARGET_MIN = 44;
// Subpixel layout can place an edge a fraction past a whole pixel.
const TOLERANCE = 0.5;

interface SafeInsets {
  right: number;
  bottom: number;
}

async function safeInsets(page: Page): Promise<SafeInsets> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const insets = {
      right: parseFloat(style.paddingRight),
      bottom: parseFloat(style.paddingBottom),
    };
    probe.remove();
    return insets;
  });
}

/** Assert the launcher sits inside the viewport less its edge offset and is a 44 px target. */
export async function expectLauncherInSafeArea(page: Page): Promise<void> {
  const launcher = page.getByRole('button', { name: LAUNCHER_NAME });
  await expect(launcher).toBeInViewport({ ratio: 1 });
  const box = await launcher.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box === null || viewport === null) return;
  const insets = await safeInsets(page);
  const right = Math.max(EDGE_OFFSET, insets.right);
  const bottom = Math.max(EDGE_OFFSET, insets.bottom);

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(
    viewport.width - right + TOLERANCE,
  );
  expect(box.y + box.height).toBeLessThanOrEqual(
    viewport.height - bottom + TOLERANCE,
  );
  expect(box.height).toBeGreaterThanOrEqual(TARGET_MIN);
}
