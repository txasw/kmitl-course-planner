// Exercises the panel error boundary through its debug trigger. The diagnostics
// drawer sets the ui store crash flag, the debug only probe inside the boundary
// throws, and the boundary shows the recovery card while the launcher and the host
// stay alive. Reloading recovers the panel. This is the wiring the Section 10.2
// requirement asks for, driven end to end in the built debug extension.

import { test, expect, openPlanner } from './support/fixtures';

test('the panel error boundary shows a recovery card and recovers', async ({
  context,
}) => {
  const page = await openPlanner(context);

  // Open the debug diagnostics drawer and force a panel render error.
  await page.getByRole('button', { name: 'Diagnostics', exact: true }).click();
  await page.getByRole('button', { name: 'Throw in panel' }).click();

  // The recovery card takes the panel body.
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('แผงหยุดทำงาน')).toBeVisible();

  // The launcher, a sibling of the panel, and the host survive: the overlay dialog
  // is still mounted and the launcher is still in the document. The launcher is
  // aria-hidden while the panel is open, so it is matched by its attribute rather
  // than by role.
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.locator('button[aria-label="เปิด KMITL Course Planner"]'),
  ).toBeAttached();

  // Reloading the panel clears the error and rebuilds the body, so the search tabs
  // return.
  await page.getByRole('button', { name: 'โหลดแผงใหม่' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'หลักสูตรและชั้นปี' }),
  ).toBeVisible();
});
