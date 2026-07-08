import { test, expect, openPlanner, pickOption } from './support/fixtures';

// The debug build exposes the diagnostics drawer. Setting the drop teach_time2
// mutation and running a query makes the contract auditor report a missing field,
// which the data quality view surfaces. The search rail sits on the left and the
// drawer on the right, so both are usable at the same time on a wide viewport.
test('surfaces a dropped teach_time2 in the report', async ({ context }) => {
  const page = await openPlanner(context);
  await page.getByRole('button', { name: 'หมวดวิชา' }).click();
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'หมวดวิชา', '90592xxx');

  await page.getByRole('button', { name: 'Diagnostics' }).click();
  await page.getByRole('button', { name: 'Simulation' }).click();
  await page
    .getByRole('combobox', { name: 'Mutation' })
    .selectOption('drop_teach_time2');

  await page.getByRole('button', { name: 'ค้นหา' }).click();

  await page.getByRole('button', { name: 'Data quality' }).click();
  await expect(page.getByText('missing_field')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('rows[0].teach_time2')).toBeVisible();
});
