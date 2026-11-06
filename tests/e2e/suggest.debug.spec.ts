import {
  test,
  expect,
  expandCourse,
  openPlanner,
  pickOption,
  waitForResultsInput,
} from './support/fixtures';
import { axeViolations } from './support/axe';

// The plan suggestion flow on the real by_class capture, curriculum 137: a GenEd the
// student placed by hand is kept, a card opens full size and back, the suggestion is
// applied as a new plan, and undo returns to the plan it started from.
const GRID_BLOCK = '[data-teach-table-id]';

test('applies a suggested timetable as a new plan and undoes it', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'ภาควิชา', '05');
  await pickOption(page, 'หลักสูตร', 'ความปลอดภัยไซเบอร์');
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(page.getByText('01006020').first()).toBeVisible({
    timeout: 15_000,
  });

  // Place one GenEd section by hand; a suggestion keeps it as a fixed constraint. Cards
  // start collapsed, so the GenEd card opens first.
  await waitForResultsInput(page);
  await expandCourse(page, '04186098');
  await page
    .getByRole('article')
    .filter({ hasText: '04186098' })
    .first()
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .click();
  // The first add names the plan from the searched term, which the suggestion keeps.
  // The switcher shows the term on a line under the name, so read the name line alone.
  const switcher = page.getByRole('button', { name: 'เลือกตาราง' });
  const firstName = switcher.getByText(/^ตาราง \d\/\d{4}$/);
  await expect(firstName).toBeVisible();
  const planName = (await firstName.textContent()) ?? '';
  await expect(page.locator(GRID_BLOCK).first()).toBeVisible();
  const placedBefore = await page.locator(GRID_BLOCK).count();

  await page.getByRole('button', { name: 'แนะนำตาราง' }).click();
  const dialog = page.getByRole('dialog', { name: 'แนะนำตาราง' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'เน้นเช้า' }).click();
  await expect(
    dialog.getByRole('button', { name: 'เน้นเช้า', pressed: true }),
  ).toBeVisible();
  const apply = dialog.getByRole('button', { name: 'ใช้ตารางนี้' });
  await expect(apply).toHaveCount(3);
  expect(await axeViolations(page)).toEqual([]);

  // The cards sit side by side; one opens full size and the back action returns to all
  // three with focus on the control that opened it.
  const expand = dialog.getByRole('button', { name: 'ดูขนาดเต็ม' });
  await expand.nth(1).click();
  await expect(
    dialog.getByRole('heading', { name: 'ตัวเลือกที่ 2' }),
  ).toBeFocused();
  await expect(apply).toHaveCount(1);
  await dialog
    .getByRole('button', { name: 'กลับไปที่ตัวเลือกทั้งหมด' })
    .click();
  await expect(apply).toHaveCount(3);
  await expect(expand.nth(1)).toBeFocused();

  await apply.first().click();
  await expect(dialog).toHaveCount(0);
  await expect(
    switcher.getByText(`${planName} เน้นเช้า`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`สร้างตาราง ${planName} เน้นเช้า แล้ว`),
  ).toBeVisible();
  await expect
    .poll(() => page.locator(GRID_BLOCK).count())
    .toBeGreaterThan(placedBefore);
  await expect(page.locator(`${GRID_BLOCK}[data-verify="danger"]`)).toHaveCount(
    0,
  );

  await page.getByRole('button', { name: 'เลิกทำ' }).click();
  await expect(switcher.getByText(planName, { exact: true })).toBeVisible();
  await expect(page.locator(GRID_BLOCK)).toHaveCount(placedBefore);
});
