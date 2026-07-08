import { test, expect, openPlanner } from './support/fixtures';

// The teach table request fails, so the catalog shows the typed error with a
// retry. Once the fault clears, retrying loads the results. Reference requests
// are never failed, so the selects still populate.
test('recovers a failed query on retry', async ({ context, mock }) => {
  mock.setApiFailure(true);
  const page = await openPlanner(context);
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
  await page.getByRole('combobox', { name: 'คณะ' }).selectOption('01');
  await page.getByRole('combobox', { name: 'หมวดวิชา' }).selectOption('32');
  await page.getByRole('button', { name: 'ค้นหา' }).click();

  await expect(
    page.getByRole('heading', { name: 'โหลดรายวิชาไม่สำเร็จ' }),
  ).toBeVisible({ timeout: 25_000 });

  mock.setApiFailure(false);
  await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();
  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
});
