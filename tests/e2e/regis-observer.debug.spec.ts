import type { Locator, Page, Worker } from '@playwright/test';
import { ROOT_KEY } from '../../src/lib/storage/keys';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import type { Replica, ReplicaPatch } from './host/pre_registration/replica.js';

// The read only observer on the static replica of the pre registration page (ADR-0077).
// The helper card opens on its own and the subject's status follows the page: not added,
// added as planned, another section, conditional on a prerequisite, refused, and on the
// complete step submitted or missing from the submitted list. No hand mark exists to set it. A count line shows over
// the host's confirm dialog while the list differs from the plan. Every host control on
// the replica counts its presses and every untrusted event is counted, so each spec ends
// by proving KCP pressed nothing and sent nothing.

declare global {
  interface Window {
    replica: Replica;
  }
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
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

function card(page: Page): Locator {
  return page.locator('#kcp-regis-card');
}

/** The subject's chip in the helper queue, which carries its status. */
function chip(page: Page): Locator {
  return card(page)
    .getByRole('list', { name: 'รายวิชา' })
    .locator('[data-status]');
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

  // The card opens on arrival with no press, and the status is the page's own.
  const status = chip(page);
  await expect(page.locator('[data-observer="healthy"]')).toBeVisible();
  await expect(status).toHaveAttribute('data-status', 'todo');
  await expect(card(page).locator('select')).toHaveCount(0);

  await drive(page, { list: [LISTED] });
  await expect(status).toHaveAttribute('data-status', 'added');
  await expect(card(page).locator('#kcp-regis-count')).toContainText('1/1');

  await drive(page, { list: [{ ...LISTED, section: '902' }] });
  await expect(status).toHaveAttribute('data-status', 'other');

  // The grade not announced dialog names the prerequisite; the card keeps it after the
  // dialog closes and the subject reaches the list.
  await drive(page, {
    list: [],
    add: { value: SUBJECT, sections: [{ section: '901', kind: 'ท' }] },
    dialog: { kind: 'grade', subjectId: SUBJECT, prerequisites: ['90000002'] },
  });
  await expect(card(page)).toContainText('รอเกรด 90000002');
  await drive(page, { dialog: null, add: {}, list: [LISTED] });
  await expect(status).toHaveAttribute('data-status', 'cond');
  await expect(card(page)).toContainText('เพิ่มแล้ว มีเงื่อนไข');
  await expect(card(page)).toContainText('รอเกรด 90000002');

  // A refusal toast for the subject, with the subject off the list.
  await drive(page, { list: [], add: { value: SUBJECT } });
  await page.evaluate((id) => {
    window.replica.toast('refused', id);
  }, SUBJECT);
  await expect(status).toHaveAttribute('data-status', 'refused');

  // The count line over the host's confirm dialog while the list differs from the plan.
  await drive(page, { add: {}, toasts: [], dialog: { kind: 'confirm' } });
  const banner = page.locator('[data-confirm-banner]');
  await expect(banner).toHaveText(
    'หน้าลงทะเบียนมี 0 จาก 1 วิชาตามแผน ตรวจก่อนกดยืนยัน',
  );
  await drive(page, { list: [LISTED] });
  await expect(banner).toHaveCount(0);
  await drive(page, { dialog: null });

  await drive(page, {
    step: 3,
    results: [{ subjectId: SUBJECT, section: '901', kind: 'ท', grade: 'Y' }],
  });
  await expect(status).toHaveAttribute('data-status', 'sent');
  await expect(card(page).locator('#kcp-regis-count')).toContainText('ส่งแล้ว');
  await expect(card(page).locator('#kcp-regis-count')).toContainText('1/1');

  // A planned subject missing from the submitted list says so, and the count is the
  // subjects submitted over those planned (owner answer A2).
  await drive(page, {
    results: [{ subjectId: '90000009', section: '901', kind: 'ท', grade: '' }],
  });
  await expect(status).toHaveAttribute('data-status', 'notSent');
  await expect(card(page).locator('#kcp-regis-count')).toContainText('0/1');
  await expect(card(page)).toContainText('ไม่อยู่ในรายการที่ส่ง');

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
  // The page lists the subject, but KCP does not read it, so the status stays its own.
  await expect(page.locator('[data-observer="off"]')).toContainText(
    'หน้าลงทะเบียนเปลี่ยนรุ่น',
  );
  await expect(chip(page)).toHaveAttribute('data-status', 'todo');
  await expectUntouched(page);

  // The surrogate key is checked for presence only; the session store survives the
  // navigation to the tested build in the same tab.
  await page.evaluate(() => {
    sessionStorage.setItem('surrogated_student_id', '00000000');
  });
  mock.clearApiCalls();
  await openReplica(page);
  await drive(page, { term, list: [LISTED] });
  await expect(page.locator('[data-observer="off"]')).toContainText(
    'อ่านหน้าไม่ได้',
  );
  await expect(chip(page)).toHaveAttribute('data-status', 'todo');
  await expectUntouched(page);
  expect(mock.apiCalls()).toEqual([]);
});
