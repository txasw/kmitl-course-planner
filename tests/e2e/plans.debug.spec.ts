import { test, expect, openPlanner, pickOption } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import type { Page } from '@playwright/test';

// The Phase 6 plan flows: a plan persists across a reload because the grid renders
// from stored snapshots, the catalog refuses a section from another term and offers a
// switch, and a revalidation reconciles a section whose time moved upstream. These run
// against the synthetic by subject id catalog so the sections are known and stable.

const LAUNCHER = 'เปิด Course Planner for KMITL';

/** Run the by subject id search after setting the term, since the term test needs a
 * specific semester rather than the form default. */
async function searchSyntheticInSemester(
  page: Page,
  semester: string,
): Promise<void> {
  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await pickOption(page, 'ภาคการศึกษา', semester);
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000000');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(page.getByText('90000001').first()).toBeVisible({
    timeout: 15_000,
  });
}

test('keeps the plan on the grid across a page reload', async ({ context }) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // Autosave debounces at 300 ms and a page reload discards the React unmount flush,
  // so wait past the debounce to be sure the plan reached storage before reloading.
  await page.waitForTimeout(500);
  await page.reload();

  // The catalog is session memory and is gone after the reload, but the grid rebuilds
  // from the stored snapshot, so reopening the panel shows the block again.
  await page.getByRole('button', { name: LAUNCHER }).click();
  await expect(page.locator(block('900001'))).toBeVisible();
});

test('refuses a section from another term and switches on request', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await searchSyntheticInSemester(page, '1');
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // Browsing semester 2 while the plan is bound to semester 1 puts every row in the
  // different term state: no add control, and a switch action instead.
  await searchSyntheticInSemester(page, '2');
  await expect(
    page.getByRole('button', { name: 'สลับไปตารางภาคนี้' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'เพิ่ม', exact: true }),
  ).toHaveCount(0);

  // Switching creates and activates a plan for the browsed term, so the rows become
  // addable again.
  await page.getByRole('button', { name: 'สลับไปตารางภาคนี้' }).first().click();
  await expect(
    page.getByRole('button', { name: 'เพิ่ม', exact: true }).first(),
  ).toBeVisible();
});

test('flags a section whose time moved upstream on refresh', async ({
  context,
  mock,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // Adding the first section creates the plan, which triggers an automatic check
  // against the base catalog. Wait for that clean result before moving the section.
  const banner = page
    .getByText(/ตรวจสอบแล้ว/)
    .locator('xpath=ancestor::div[1]');
  await expect(banner).toBeVisible({ timeout: 15_000 });

  // Serve the moved time variant, then refresh from the banner: the replay reconciles
  // the section, the summary reports one change, and the block carries the warn badge.
  mock.setFreshSynthetic(true);
  await banner.getByRole('button', { name: 'รีเฟรช' }).click();
  await expect(page.getByText(/เปลี่ยน 1/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.locator(`${block('900001')}[data-verify="warn"]`),
  ).toBeVisible();
});
