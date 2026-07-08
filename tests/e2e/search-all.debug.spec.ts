import { test, expect, openPlanner, pickOption } from './support/fixtures';

// The mock rejects a present but empty selected_class_year with the real API's
// "not integer" body, so these specs fail if the search-all construction
// regresses to the empty value.

test('searches by class with the all curricula and all class year options', async ({
  context,
}) => {
  const page = await openPlanner(context);
  // by_class is the default tab; class year defaults to the all option.
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'ภาควิชา', '08');
  await pickOption(page, 'หลักสูตร', 'ทุกหลักสูตร');
  await page.getByRole('button', { name: 'ค้นหา' }).click();

  // The all curricula path returns unscheduled rows with a null teachtime_str.
  // The scheduled row renders, and the unscheduled row does not fail the result.
  await expect(page.getByText('01006001').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('01006029').first()).toBeVisible();
});

test('searches a subject id across everything', async ({ context }) => {
  const page = await openPlanner(context);
  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill('90592033');
  await page.getByRole('button', { name: 'ค้นหา' }).click();

  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
});

test('searches a category across all faculties', async ({ context }) => {
  const page = await openPlanner(context);
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', 'ทุกคณะ');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await page.getByRole('button', { name: 'ค้นหา' }).click();

  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
});
