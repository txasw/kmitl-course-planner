import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { waitForInstallTab } from './support/onboarding';

// The welcome at the phone and tablet sizes (ADR-0062). Below 640 px it is a bottom
// sheet across the full width, and from 640 px a narrow dialog centred in the
// viewport, like the updates dialog. Either way it sits wholly inside the viewport,
// which the emulated devices report with no safe area insets, and Start planning is
// a 44 px target for a finger.

test.use({ onboarding: 'fresh' });

const WELCOME = 'ขอบคุณที่ติดตั้ง Course Planner for KMITL';
const START = 'เริ่มวางแผน';
const MIN_TARGET_PX = 44;

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 640;
}

async function box(locator: Locator) {
  const measured = await locator.boundingBox();
  if (measured === null) throw new Error('The welcome is not laid out');
  return measured;
}

test('lays the welcome out for the device and keeps Start planning reachable', async ({
  context,
}) => {
  const tab = await waitForInstallTab(context);
  const welcome = tab.getByRole('dialog', { name: WELCOME });
  await expect(welcome).toBeVisible();
  const viewport = tab.viewportSize();
  if (viewport === null) throw new Error('The project sets no viewport');

  if (isPhone(tab)) {
    // The sheet slides in from the bottom edge, so its final place is polled.
    await expect
      .poll(async () => {
        const { y, height } = await box(welcome);
        return Math.round(y + height);
      })
      .toBe(viewport.height);
    const { x, width } = await box(welcome);
    expect(Math.round(x)).toBe(0);
    expect(Math.round(width)).toBe(viewport.width);
  } else {
    const { x, y, width, height } = await box(welcome);
    expect(width).toBeLessThan(viewport.width);
    expect(Math.abs(viewport.width - (x + width) - x)).toBeLessThanOrEqual(1);
    expect(Math.abs(viewport.height - (y + height) - y)).toBeLessThanOrEqual(1);
  }
  await expect(welcome).toBeInViewport({ ratio: 1 });

  const start = welcome.getByRole('button', { name: START });
  await expect(start).toBeInViewport({ ratio: 1 });
  expect((await box(start)).height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
});
