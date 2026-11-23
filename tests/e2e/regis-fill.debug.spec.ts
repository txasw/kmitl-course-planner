import type { Page, Worker } from '@playwright/test';
import { REGKIT_KEY, ROOT_KEY } from '../../src/lib/storage/keys';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { addCourse, block, syntheticSearch } from './support/synthetic';
import type {
  Replica,
  ReplicaConfig,
} from './host/pre_registration/replica.js';

// Fill on the behaviour replica of the pre registration page (ADR-0078). A student press
// on Fill all enters the planned subject, chooses its section through the host's own
// menu, and presses Add, and nothing else. Every spec ends by proving that no control
// outside the allowlist (Continue, the confirm dialog's buttons, the trash icons, the
// links, the pattern table) got a press or an event, that nothing was written, and that
// KCP sent no request of its own. The hostile variants relabel the buttons, dress the
// confirm dialog as the grade dialog, move focus to Continue, submit on Enter, or serve
// an untested build, and each must end with the fill stopped or never started.

declare global {
  interface Window {
    replica: Replica;
  }
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const DOCK_LAUNCHER = 'เปิดเช็กลิสต์ ตัวช่วยลงทะเบียน';
const SUBJECT = '90000001';

interface StoredEntry {
  subjectId: string;
  teachTableId: string;
  section: string;
  sourceQuery: unknown;
  snapshot: {
    section: string;
    kind: 'lecture' | 'practice';
    subjectMeta: {
      nameTh: string;
      nameEn: string;
      credit: number;
      creditStr: string;
    };
  };
}

interface StoredPlan {
  id: string;
  year: string;
  semester: string;
  entries: StoredEntry[];
}

interface WorkerStorage {
  chrome: {
    storage: {
      local: {
        get(key: string): Promise<Record<string, { plans: StoredPlan[] }>>;
        set(items: Record<string, unknown>): Promise<void>;
      };
    };
  };
}

/**
 * Plan one section, then store a kit for it as the prepare action would have at a calm
 * time, built from the stored plan entry, so the spec sends no kit read of its own.
 */
async function planWithKit(page: Page, serviceWorker: Worker) {
  await syntheticSearch(page);
  await addCourse(page, SUBJECT);
  await expect(page.locator(block('900001'))).toBeVisible();
  // Autosave debounces at 300 ms.
  await page.waitForTimeout(500);
  return serviceWorker.evaluate(
    async ({ root, regkit, now }) => {
      // Test only: the debug extension worker carries the storage global above.
      const { local } = (globalThis as unknown as WorkerStorage).chrome.storage;
      const plan = (await local.get(root))[root]?.plans[0];
      const entry = plan?.entries[0];
      if (plan === undefined || entry === undefined) throw new Error('no plan');
      const meta = entry.snapshot.subjectMeta;
      const kit = {
        planId: plan.id,
        year: plan.year,
        semester: plan.semester,
        preparedAt: now,
        subjects: [
          {
            subjectId: entry.subjectId,
            nameTh: meta.nameTh,
            nameEn: meta.nameEn,
            credit: meta.credit,
            creditStr: meta.creditStr,
            sourceQuery: entry.sourceQuery,
            sections: [entry.snapshot],
            plannedIds: [entry.teachTableId],
            options: [
              {
                ids: [entry.teachTableId],
                planned: true,
                fit: 'fits',
                seat: 'open',
                ownCurriculum: null,
              },
            ],
            duplicateCodes: [],
          },
        ],
        unread: [],
      };
      await local.set({ [regkit]: { schemaVersion: 1, items: [kit] } });
      return {
        term: { year: plan.year, semester: plan.semester },
        section: entry.snapshot.section,
      };
    },
    { root: ROOT_KEY, regkit: REGKIT_KEY, now: new Date().toISOString() },
  );
}

async function openReplica(
  page: Page,
  term: { year: string; semester: string },
  config: ReplicaConfig,
  query = '',
): Promise<void> {
  await page.goto(`${REPLICA_URL}${query}${HASH}`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, options }) => {
      window.replica.set({ term: next });
      window.replica.configure({ ...options, xhr: true });
    },
    { next: term, options: config },
  );
  await page.getByRole('button', { name: DOCK_LAUNCHER }).click();
}

async function setUp(
  page: Page,
  serviceWorker: Worker,
  config: (section: string) => ReplicaConfig = (section) => ({
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }),
  query = '',
) {
  const { term, section } = await planWithKit(page, serviceWorker);
  await openReplica(page, term, config(section), query);
  return section;
}

/** Press a fill control the way a student does, after it has been on screen a moment. */
async function press(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeVisible();
  await page.waitForTimeout(700);
  await button.click();
}

async function expectNothingForbidden(page: Page): Promise<void> {
  const counters = await page.evaluate(() => ({
    forbidden: window.replica.forbidden(),
    writes: window.replica.counters.writes,
    confirm: window.replica.counters.clicks.confirm ?? 0,
    continue: window.replica.counters.clicks.continue ?? 0,
  }));
  expect(counters).toEqual({
    forbidden: 0,
    writes: 0,
    confirm: 0,
    continue: 0,
  });
}

function listed(page: Page) {
  return page.evaluate(() =>
    window.replica.state.list.map((row) => `${row.subjectId} ${row.section}`),
  );
}

test('fills the planned subject on a press and touches nothing else', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const section = await setUp(page, serviceWorker);
  mock.clearApiCalls();
  await press(page, 'กรอกทุกวิชา');
  await expect(page.locator('[data-fill="done"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([`${SUBJECT} ${section}`]);
  await expect(
    page.locator('li').filter({ hasText: SUBJECT }).locator('[data-observed]'),
  ).toHaveAttribute('data-observed', 'listed');
  const reached = await page.evaluate(
    () => window.replica.counters.untrustedOn,
  );
  expect(Object.keys(reached).sort()).toEqual(
    ['add', 'option', 'sectionSelect', 'subjectField'].sort(),
  );
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);
});

test('stops on a relabelled Add and presses no Continue', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'continueAsAdd',
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }));
  await press(page, 'กรอกทุกวิชา');
  await expect(page.locator('[data-fill-stop="notRecognised"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([]);
  await expectNothingForbidden(page);
});

test('presses nothing in a confirm dialog dressed as the grade dialog', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'confirmAsGrade',
    catalog: {
      [SUBJECT]: {
        sections: [{ section, kind: 'ท' }],
        prerequisites: ['90000002'],
      },
    },
  }));
  await press(page, 'กรอกทุกวิชา');
  await expect(page.locator('[data-fill-stop="notRecognised"]')).toBeVisible({
    timeout: 15_000,
  });
  await expectNothingForbidden(page);
});

test('acknowledges the real grade dialog only after showing the condition', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    catalog: {
      [SUBJECT]: {
        sections: [{ section, kind: 'ท' }],
        prerequisites: ['90000002'],
      },
    },
  }));
  await press(page, 'กรอกทุกวิชา');
  await expect(page.getByText('ต้องผ่าน 90000002 ก่อน')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => window.replica.counters.clicks.acknowledge ?? 0),
  ).toBe(0);
  await expect(page.locator('[data-fill="done"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => window.replica.counters.clicks.acknowledge),
  ).toBe(1);
  await expectNothingForbidden(page);
});

test('stops when focus moves to Continue', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'focusContinue',
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }));
  await press(page, 'กรอกทุกวิชา');
  await expect(page.locator('[data-fill-stop="pageChanged"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(await listed(page)).toEqual([]);
  await expectNothingForbidden(page);
});

test('sends no key, so a page that submits on Enter submits nothing', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, (section) => ({
    variant: 'enterSubmits',
    catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' }] } },
  }));
  const button = page.getByRole('button', { name: 'กรอกทุกวิชา', exact: true });
  await expect(button).toBeVisible();
  await page.waitForTimeout(700);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-fill="done"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() => window.replica.counters.clicks.enter ?? 0),
  ).toBe(0);
  await expectNothingForbidden(page);
});

test('offers no fill on an untested host build', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await setUp(page, serviceWorker, undefined, '?build=untested');
  await expect(page.locator('[data-observer="off"]')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'กรอกทุกวิชา', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'กรอกวิชานี้', exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.replica.interactions())).toBe(0);
});
