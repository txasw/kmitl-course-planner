import type { Locator, Page, Worker } from '@playwright/test';
import { ROOT_KEY } from '../../src/lib/storage/keys';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import type { Replica, ReplicaPatch } from './host/pre_registration/replica.js';

// The read only observer on the static replica of the pre registration page (ADR-0077).
// The checklist row ticks itself as the page changes: not on the list, on the list as
// planned, another section, conditional on a prerequisite, refused, and the result on
// the complete step. The student's own mark overrides the page and both stay in view,
// and a count line shows over the host's confirm dialog while the list differs from the
// plan. Every host control on the replica counts its presses and every untrusted event
// is counted, so each spec ends by proving KCP pressed nothing and sent nothing.

declare global {
  interface Window {
    replica: Replica;
  }
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const DOCK_LAUNCHER = 'เปิดเช็กลิสต์ ตัวช่วยลงทะเบียน';
const SUBJECT = '90000001';
const LISTED = { subjectId: SUBJECT, section: '901', kind: 'ท' } as const;

interface StoredRoot {
  plans: { year: string; semester: string }[];
}

interface WorkerStorage {
  chrome: {
    storage: {
      local: { get(key: string): Promise<Record<string, StoredRoot>> };
    };
  };
}

/** Plan one section on the search page, then return the plan's term from storage. */
async function planOneSubject(
  page: Page,
  serviceWorker: Worker,
): Promise<{ year: string; semester: string }> {
  await syntheticSearch(page);
  await addCourse(page, SUBJECT);
  await expect(page.locator(block('900001'))).toBeVisible();
  // Autosave debounces at 300 ms.
  await page.waitForTimeout(500);
  return serviceWorker.evaluate(async (key) => {
    // Test only assertion: the debug extension worker carries the storage global above.
    const globals = globalThis as unknown as WorkerStorage;
    const plan = (await globals.chrome.storage.local.get(key))[key]?.plans[0];
    if (plan === undefined) throw new Error('no stored plan');
    return { year: plan.year, semester: plan.semester };
  }, ROOT_KEY);
}

async function drive(page: Page, patch: ReplicaPatch): Promise<void> {
  await page.evaluate((next) => {
    window.replica.set(next);
  }, patch);
}

async function openReplica(page: Page, query = ''): Promise<void> {
  await page.goto(`${REPLICA_URL}${query}${HASH}`);
  await page.waitForFunction(() => 'replica' in window);
}

function checklistRow(page: Page): Locator {
  return page.locator('li').filter({ hasText: SUBJECT }).first();
}

async function expectUntouched(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.replica.interactions())).toBe(0);
}

test('ticks the checklist as the page changes and never acts on it', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const term = await planOneSubject(page, serviceWorker);
  await openReplica(page);
  await drive(page, { term });
  mock.clearApiCalls();
  await page.getByRole('button', { name: DOCK_LAUNCHER }).click();

  const row = checklistRow(page);
  const observed = row.locator('[data-observed]');
  await expect(page.locator('[data-observer="healthy"]')).toBeVisible();
  await expect(observed).toHaveAttribute('data-observed', 'notListed');

  await drive(page, { list: [LISTED] });
  await expect(observed).toHaveAttribute('data-observed', 'listed');
  await expect(page.getByText('ทำแล้ว 1 จาก 1 วิชา')).toBeVisible();

  await drive(page, { list: [{ ...LISTED, section: '902' }] });
  await expect(observed).toHaveAttribute('data-observed', 'listedOther');

  // The grade not announced dialog names the prerequisite; the row keeps it after the
  // dialog closes and the subject reaches the list.
  await drive(page, {
    list: [],
    add: { value: SUBJECT, sections: [{ section: '901', kind: 'ท' }] },
    dialog: { kind: 'grade', subjectId: SUBJECT, prerequisites: ['90000002'] },
  });
  await expect(row).toContainText('90000002');
  await drive(page, { dialog: null, add: {}, list: [LISTED] });
  await expect(observed).toHaveAttribute('data-observed', 'listed');
  await expect(row).toContainText('ลงได้แบบมีเงื่อนไข');
  await expect(row).toContainText('90000002');

  // A refusal toast for the subject, with the subject off the list.
  await drive(page, { list: [], add: { value: SUBJECT } });
  await page.evaluate((id) => {
    window.replica.toast('refused', id);
  }, SUBJECT);
  await expect(observed).toHaveAttribute('data-observed', 'refused');

  // The count line over the host's confirm dialog while the list differs from the plan.
  await drive(page, { add: {}, toasts: [], dialog: { kind: 'confirm' } });
  const banner = page.locator('[data-confirm-banner]');
  await expect(banner).toHaveText(
    'หน้าลงทะเบียนมี 0 จาก 1 วิชาตามแผน ตรวจก่อนกดยืนยัน',
  );
  await drive(page, { list: [LISTED] });
  await expect(banner).toHaveCount(0);
  await drive(page, { dialog: null });

  // The student's mark overrides the page, and the page reading stays beside it.
  await row.getByRole('combobox').selectOption('skipped');
  await expect(row).toContainText('ใช้เครื่องหมายที่คุณเลือกแทน');
  await expect(observed).toHaveAttribute('data-observed', 'listed');
  await row.getByRole('combobox').selectOption('notDone');

  await drive(page, {
    step: 3,
    results: [{ subjectId: SUBJECT, section: '901', kind: 'ท', grade: 'Y' }],
  });
  await expect(observed).toHaveAttribute('data-observed', 'granted');

  await expectUntouched(page);
  expect(mock.apiCalls()).toEqual([]);
});

test('stays off on an untested host build and in a surrogate session', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const term = await planOneSubject(page, serviceWorker);

  await openReplica(page, '?build=untested');
  await drive(page, { term, list: [LISTED] });
  await page.getByRole('button', { name: DOCK_LAUNCHER }).click();
  await expect(page.locator('[data-observer="off"]')).toContainText(
    'ยังไม่ได้ทดสอบ',
  );
  await expect(checklistRow(page).locator('[data-observed]')).toHaveCount(0);
  await expectUntouched(page);

  // The surrogate key is checked for presence only; the session store survives the
  // navigation to the tested build in the same tab.
  await page.evaluate(() => {
    sessionStorage.setItem('surrogated_student_id', '00000000');
  });
  mock.clearApiCalls();
  await openReplica(page);
  await drive(page, { term, list: [LISTED] });
  await page.getByRole('button', { name: DOCK_LAUNCHER }).click();
  await expect(page.locator('[data-observer="off"]')).toContainText(
    'เปิดแทนนักศึกษา',
  );
  await expect(checklistRow(page).locator('[data-observed]')).toHaveCount(0);
  await expectUntouched(page);
  expect(mock.apiCalls()).toEqual([]);
});
