import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, block } from './support/synthetic';

// The reserved id 90000010 serves two subjects: Exam Course A on Tue and Exam Course B with
// two sections. B section 901 is on Thu, so it never collides in time with A, but its
// midterm overlaps A's, and B section 902 is on Fri with a midterm on another day, a clean
// alternative. Adding A then B section 901 must be blocked on exam grounds, and adding the
// clean alternative from the strip must succeed.
test('an exam conflicting add blocks and a clean alternative succeeds', async ({
  context,
}) => {
  const page = await openPlanner(context);

  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000010');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByText('90000010').first()).toBeVisible({
    timeout: 15_000,
  });

  // Course A lands on the grid.
  await addCourse(page, '90000010');
  await expect(page.locator(block('910001'))).toBeVisible();

  // Adding B section 901 is blocked: its midterm overlaps A's. Nothing lands, and the
  // strip states the exam reason, naming the blocking subject and the exam type.
  await addCourse(page, '90000011');
  await expect(page.locator(block('910002'))).toHaveCount(0);
  const strip = page.getByRole('button', {
    name: 'กลุ่มเรียน 902',
    exact: true,
  });
  await expect(strip).toBeVisible();
  await expect(page.getByText(/เวลาสอบชนกับ 90000010/)).toBeVisible();
  await expect(page.getByText(/สอบกลางภาค/)).toBeVisible();

  // The clean alternative from the strip adds without a clash.
  await strip.click();
  await expect(page.locator(block('910003'))).toBeVisible();
  await expect(page.locator(block('910002'))).toHaveCount(0);
});
