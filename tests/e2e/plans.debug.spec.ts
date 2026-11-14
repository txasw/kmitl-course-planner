import {
  test,
  expect,
  editSearch,
  expandCourse,
  openPlanner,
  pickOption,
  submitSearch,
} from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import type { Page } from '@playwright/test';

// The Phase 6 plan flows: a plan persists across a reload because the grid renders
// from stored snapshots, the catalog refuses a section from another term and offers a
// switch, and a revalidation reconciles a section whose time moved upstream, which the
// student then reviews and acknowledges in the updates dialog. These run against the
// synthetic by subject id catalog so the sections are known and stable.

const LAUNCHER = 'เปิด KCP: Course Planner for KMITL';

/** Run the by subject id search after setting the term, since the term test needs a
 * specific semester rather than the form default. */
async function searchSyntheticInSemester(
  page: Page,
  semester: string,
): Promise<void> {
  await page.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
  await pickOption(page, 'ภาคการศึกษา', semester);
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90000000');
  await submitSearch(page);
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
  // different term state: the add rail is disabled, and a switch action shows instead.
  // No plan exists for semester 2 yet, so the action says it creates one.
  // The first search folded the form, so it is reopened from the summary bar.
  await editSearch(page);
  await searchSyntheticInSemester(page, '2');
  await expandCourse(page, '90000003');
  const createPlan = page
    .getByRole('button', { name: /^สร้างตารางภาค 2\// })
    .first();
  await expect(createPlan).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^เพิ่ม/, disabled: false }),
  ).toHaveCount(0);

  // Switching creates and activates a plan for the browsed term, so the rows become
  // addable again.
  await createPlan.click();
  await expect(
    page.getByRole('button', { name: /^เพิ่ม/, disabled: false }).first(),
  ).toBeVisible();
});

test('flags a moved section on refresh and acknowledges it in the dialog', async ({
  context,
  mock,
}) => {
  const page = await openPlanner(context);
  await syntheticSearch(page);
  await addCourse(page, '90000001');
  await expect(page.locator(block('900001'))).toBeVisible();

  // Adding the first section creates the plan, which triggers an automatic check
  // against the base catalog. That check still runs and reports verified, while the
  // updates dialog stays closed for it. Wait for that clean result before moving the
  // section.
  // The check settles into the verification status at the end of the stats bar.
  const stats = page.getByRole('group', { name: 'สรุปตาราง', exact: true });
  await expect(stats.getByText(/ตรวจสอบแล้ว/)).toBeVisible({ timeout: 15_000 });
  const dialog = page.getByRole('dialog', {
    name: 'ข้อมูลในตารางมีการเปลี่ยนแปลง',
  });
  await expect(dialog).toHaveCount(0);

  // Serve the moved time variant, then check again from the stats bar: the replay reconciles
  // the section, the summary reports one change, and the block carries the warn badge.
  // A manual check that finds a change opens the updates dialog directly, listing the
  // time change with its old and new values and starting focus on the acknowledgement.
  mock.setFreshSynthetic(true);
  await stats.getByRole('button', { name: 'ตรวจสอบอีกครั้ง' }).click();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(stats.getByText(/เปลี่ยน 1/)).toBeVisible();
  await expect(
    page.locator(`${block('900001')}[data-verify="warn"]`),
  ).toBeVisible();
  await expect(dialog.getByText('เวลาเรียนเปลี่ยน')).toBeVisible();
  await expect(dialog.getByText('เดิม', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ใหม่', { exact: true })).toBeVisible();
  const acknowledge = dialog.getByRole('button', { name: 'รับทราบทั้งหมด' });
  await expect(acknowledge).toBeFocused();

  // Acknowledging clears the review: the dialog closes with one toast, and the block
  // no longer carries the warn badge.
  await acknowledge.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('รับทราบการเปลี่ยนแปลงแล้ว')).toBeVisible();
  await expect(
    page.locator(`${block('900001')}[data-verify="warn"]`),
  ).toHaveCount(0);
});
