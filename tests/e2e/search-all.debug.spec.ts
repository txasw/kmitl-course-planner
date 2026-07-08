import { test, expect, openPlanner } from './support/fixtures';

// The mock rejects a present but empty selected_class_year with the real API's
// "not integer" body, so these specs fail if the search-all construction
// regresses to the empty value.

test('searches by class with the all class year option', async ({
  context,
}) => {
  const page = await openPlanner(context);
  // by_class is the default tab; class year defaults to the all option.
  await page.getByRole('combobox', { name: 'คณะ' }).selectOption('01');
  await page.getByRole('combobox', { name: 'ภาควิชา' }).selectOption('08');
  await page.getByRole('combobox', { name: 'หลักสูตร' }).selectOption('121');
  await page.getByRole('button', { name: 'ค้นหา' }).click();

  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
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
