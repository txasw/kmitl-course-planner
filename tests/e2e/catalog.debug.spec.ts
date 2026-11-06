import {
  test,
  expect,
  expandCourse,
  openPlanner,
  pickOption,
} from './support/fixtures';

// With no persisted search, no result route, and no plan, the form opens on the term
// after the one the registrar reports as current. The capture reports 1/2569.
test('opens the search form on the next registration term', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await expect(page.getByRole('combobox', { name: 'ปีการศึกษา' })).toHaveValue(
    '2569',
  );
  await expect(page.getByRole('combobox', { name: 'ภาคการศึกษา' })).toHaveValue(
    '2',
  );
});

// A category search for subject owner 32 in faculty 01. The owner 32 capture
// carries 13 raw rows that dedupe to 4 unique sections across 3 courses, so the
// catalog proves the dedupe by rendering exactly that.
test('renders the deduped catalog for a category search', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await page.getByRole('tab', { name: 'หมวดวิชา', exact: true }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();

  // The catalog mounts once, so each subject and the summary match exactly one
  // node.
  await expect(page.getByText('90592033', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // Each collapsed card counts its own sections too, and the status announcer names
  // the same count, so the total is read from the summary row.
  await expect(
    page.locator('[data-catalog-summary]').getByText('4 กลุ่มเรียน'),
  ).toBeVisible();
  // A collapsed card says whether opening it is worth it: both sections of 90592033
  // are full.
  await expect(
    page
      .locator('article')
      .filter({ hasText: '90592033' })
      .locator('[data-course-meta]'),
  ).toHaveText(/2 กลุ่มเรียน.*เต็มหรือปิดทุกกลุ่ม/);
  await expect(page.getByRole('status').filter({ hasText: 'พบ' })).toHaveText(
    'พบ 3 รายวิชา 4 กลุ่มเรียน',
  );

  // Every card of the three course result starts collapsed and mounts no section
  // row, so no section drag surface exists until a card opens.
  const toggles = page.locator('[data-course-toggle]');
  await expect(toggles).toHaveCount(3);
  await expect(
    page.locator('[data-course-toggle][aria-expanded="true"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-drag-surface="section"]')).toHaveCount(0);

  // Opened, both sections of 90592033 are full and are no drag source, so the two
  // open sections register exactly one drag surface each.
  for (const subjectId of ['90592008', '90592033', '90592004']) {
    await expandCourse(page, subjectId);
  }
  await expect(page.locator('[data-drag-surface="section"]')).toHaveCount(2);
});

test.describe('at 1280x720', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  // The curriculum form is the tallest, so before the fold its loading skeleton sat
  // below the fold of a 720 px laptop and a cached answer changed nothing visible.
  // The form now folds at the press into the summary bar, with the results under it.
  test('folds the curriculum form into the summary bar at the press', async ({
    context,
  }) => {
    const page = await openPlanner(context);
    await pickOption(page, 'คณะ', '01');
    await pickOption(page, 'ภาควิชา', '08');
    await pickOption(page, 'หลักสูตร', 'ทุกหลักสูตร');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();

    await expect(
      page.getByRole('region', { name: 'การค้นหาปัจจุบัน' }),
    ).toBeInViewport();
    await expect(
      page
        .getByRole('status', { name: 'กำลังโหลดรายวิชา' })
        .or(page.getByRole('article'))
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'แก้ไขการค้นหา' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});

test('opens and closes a course card from the keyboard', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await page.getByRole('tab', { name: 'หมวดวิชา', exact: true }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();

  const toggle = page
    .getByRole('article')
    .filter({ hasText: '90592008' })
    .locator('[data-course-toggle]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false', {
    timeout: 15_000,
  });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
