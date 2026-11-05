import { test, expect, openPlanner, pickOption } from './support/fixtures';

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
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();

  // The catalog renders in both the dominant column and the collapsed drawer, so
  // the first match is the visible column.
  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('4 กลุ่มเรียน').first()).toBeVisible();
});
