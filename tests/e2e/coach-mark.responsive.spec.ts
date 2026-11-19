import { test, expect, gotoSelector } from './support/fixtures';
import {
  COACH_MARK,
  coachMark,
  expectCoachMarkLaidOut,
} from './support/coachMark';
import { allowCoachMark } from './support/onboarding';

// The search page coach mark on a phone and a tablet with touch (ADR-0072). Under a
// coarse pointer the buttons grow to 44 px targets, and the layout guard still holds: no
// part covers another or the launcher, and no text overflows. A tap on Maybe later
// hides it and leaves the launcher where a thumb finds it.

const SHOW_TIMEOUT_MS = 10_000;
const MIN_TARGET_PX = 44;
const ENTRANCE_MS = 1000;

test('fits above the launcher with touch sized buttons, and hides on a tap', async ({
  context,
}) => {
  await allowCoachMark(context);
  const page = await gotoSelector(context);
  const dialog = coachMark(page);
  await expect(dialog).toBeVisible({ timeout: SHOW_TIMEOUT_MS });
  await page.waitForTimeout(ENTRANCE_MS);
  await expectCoachMarkLaidOut(page, 'th');

  for (const name of [COACH_MARK.th.later, COACH_MARK.th.notToday]) {
    const box = await dialog.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  }

  await dialog.getByRole('button', { name: COACH_MARK.th.later }).tap();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: COACH_MARK.th.launcher }),
  ).toBeInViewport({ ratio: 1 });
});
