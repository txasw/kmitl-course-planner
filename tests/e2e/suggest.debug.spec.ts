import {
  test,
  expect,
  expandCourse,
  openPlanner,
  pickOption,
  waitForResultsInput,
  submitSearch,
} from './support/fixtures';
import { axeViolations } from './support/axe';

// The plan suggestion flow on the real by_class capture, curriculum 137: a GenEd the
// student placed by hand is listed by name and ticked, the carousel pages by its chevron
// and the arrow keys, its chevron names open clear of the close button, a slide lists its
// subjects behind the chevron disclosure, the suggestion is applied as a new plan, and undo
// returns to the plan it started from.
const GRID_BLOCK = '[data-teach-table-id]';

test('applies a suggested timetable as a new plan and undoes it', async ({
  context,
}) => {
  const page = await openPlanner(context);
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'ภาควิชา', '05');
  await pickOption(page, 'หลักสูตร', 'ความปลอดภัยไซเบอร์');
  await submitSearch(page);
  await expect(page.getByText('01006020').first()).toBeVisible({
    timeout: 15_000,
  });

  // Place one GenEd section by hand; the suggestion lists it ticked and keeps it. Cards
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

  // The plan status row under the timetable carries the one entry point beside the docked
  // column, which carries none of its own.
  await expect(
    page.locator('#kcp-catalog-column').getByRole('button', {
      name: 'แนะนำตาราง',
    }),
  ).toHaveCount(0);
  await page
    .getByRole('group', { name: 'สรุปตาราง', exact: true })
    .getByRole('button', { name: 'แนะนำตาราง' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'แนะนำตาราง' });
  await expect(dialog).toBeVisible();
  const planned = dialog.getByRole('region', { name: 'อยู่ในตารางแล้ว' });
  await expect(
    planned.getByRole('checkbox', { name: /04186098/ }),
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'เน้นเช้า' }).click();
  await expect(
    dialog.getByRole('button', { name: 'เน้นเช้า', pressed: true }),
  ).toBeVisible();
  const shown = dialog.locator('[data-suggest-slide]:not([inert])');
  const apply = shown.getByRole('button', { name: 'ใช้ตารางนี้' });
  await expect(apply).toHaveCount(1);
  expect(await axeViolations(page)).toEqual([]);

  // One suggestion per slide: the next chevron pages, the position line announces it, and
  // the arrow keys page back from the slide itself.
  await dialog.getByRole('button', { name: 'ตัวเลือกถัดไป' }).click();
  await expect(shown.getByRole('heading', { name: 'ตัวเลือกที่ 2' })).toBeVisible();
  // The slide names its subjects behind the system chevron disclosure, not a native one.
  const placedList = shown.getByRole('button', { name: /^วิชาในตัวเลือกนี้/ });
  await expect(placedList).toHaveAttribute('aria-expanded', 'false');
  await placedList.click();
  await expect(placedList).toHaveAttribute('aria-expanded', 'true');
  await expect(shown.getByText(/^04186098 /).first()).toBeVisible();
  await expect(dialog.locator('details, summary')).toHaveCount(0);
  await expect(dialog.getByText('ตัวเลือก 2 จาก 3')).toHaveAttribute(
    'aria-live',
    'polite',
  );
  await dialog.getByRole('group', { name: 'ตัวเลือก 2 จาก 3' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(shown.getByRole('heading', { name: 'ตัวเลือกที่ 1' })).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'ตัวเลือกที่ 1' }),
  ).toHaveAttribute('aria-current', 'true');

  await apply.click();
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

test('explains the curriculum search before one ran and opens it', async ({
  context,
}) => {
  const page = await openPlanner(context);
  // Before any search the status row still ends with the action, for the tour to show.
  const suggest = page
    .getByRole('group', { name: 'สรุปตาราง', exact: true })
    .getByRole('button', { name: 'แนะนำตาราง' });
  await suggest.click();
  const dialog = page.getByRole('dialog', { name: 'แนะนำตาราง' });
  await expect(dialog).toContainText('ค้นหาตามหลักสูตรก่อน');
  const search = dialog.getByRole('button', { name: 'ค้นหาตามหลักสูตร' });
  await expect(search).toBeFocused();
  expect(await axeViolations(page)).toEqual([]);
  await search.click();
  await expect(dialog).toHaveCount(0);
  const tab = page.getByRole('tab', { name: 'หลักสูตร' });
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(tab).toBeFocused();
});
