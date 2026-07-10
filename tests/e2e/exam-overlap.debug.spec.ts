import { test, expect, openPlanner } from './support/fixtures';
import { addCourse } from './support/synthetic';

// The reserved id 90000010 serves two courses on different days, so both add without a
// time conflict, whose midterm windows overlap. Adding the second must succeed and warn.
test('an overlapping exam warns without blocking the add', async ({
  context,
}) => {
  const page = await openPlanner(context);

  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000010');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByText('90000010').first()).toBeVisible({
    timeout: 15_000,
  });

  await addCourse(page, '90000010');
  await addCourse(page, '90000011');

  // The second add went through and the strip states the exam overlap.
  await expect(page.getByText(/เวลาสอบชนกับ/)).toBeVisible();
  // Both placed blocks carry the warn badge, distinct from a danger time conflict.
  await expect(
    page.locator('[data-teach-table-id][data-verify="warn"]'),
  ).toHaveCount(2);
});
