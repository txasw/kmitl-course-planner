import {
  test,
  expect,
  openPlanner,
  pickOption,
  submitSearch,
} from './support/fixtures';

// The teach table request fails, so the catalog shows the typed error with a
// retry. Once the fault clears, retrying loads the results. Reference requests
// are never failed, so the selects still populate.
test('recovers a failed query on retry', async ({ context, mock }) => {
  mock.setApiFailure(true);
  const page = await openPlanner(context);
  await page.getByRole('tab', { name: 'หมวดวิชา', exact: true }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');
  await submitSearch(page);

  await expect(
    page.getByRole('heading', { name: 'โหลดรายวิชาไม่สำเร็จ' }),
  ).toBeVisible({ timeout: 25_000 });

  mock.setApiFailure(false);
  await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();
  await expect(page.getByText('90592033').first()).toBeVisible({
    timeout: 15_000,
  });
});
