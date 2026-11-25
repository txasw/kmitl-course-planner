import type { BrowserContext, Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { REGKIT_KEY, ROOT_KEY } from '../../src/lib/storage/keys';
import {
  ClosedRoot,
  type Box,
  attr,
  roleNamed,
  textOf,
  withAttr,
} from './support/closedRoot';
import type { DomNode } from './support/closedRoot';
import { test, expect, launchExtension, openPlanner } from './support/fixtures';
import type { MockServer } from './support/mockServer';
import { settleOnboarding } from './support/onboarding';
import { planWithKit, type KitAlternative } from './support/regisKit';
import { extensionWorker } from './support/worker';
import type { Replica } from './host/pre_registration/replica.js';

// The registration helper in the production build, whose closed shadow root no debug spec
// can see: a document listener there sees every press inside KCP retargeted to the shadow
// host. The spec taps the closed root's own nodes through the DevTools protocol at a phone
// size with touch, as the student did on the phone, and proves each press does what it
// says: the more menu's items, a section option, Add all for me, and Check again. The plan
// is made through the debug build, whose open root the planner helpers need, and its
// storage is copied into the production profile before the page loads.

declare global {
  interface Window {
    replica: Replica;
  }
}

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const SUBJECTS = ['90000001', '90000003', '90000005'] as const;
const [FIRST, SECOND] = SUBJECTS;
const OTHER_SECTION: KitAlternative = {
  teachTableId: '900004',
  section: '902',
  day: 3,
};

test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

interface Seeded {
  blobs: Record<string, unknown>;
  term: { year: string; semester: string };
  sections: Record<string, string>;
}

/** Plan the subjects with a kit in the debug build, and return its stored blobs. */
async function seedThroughDebug(mock: MockServer): Promise<Seeded> {
  const debug = await launchExtension('.output/chrome-mv3-debug', mock, {
    viewport: DESKTOP,
  });
  try {
    await settleOnboarding(debug);
    const worker = await extensionWorker(debug);
    const page = await openPlanner(debug);
    const { term, sections } = await planWithKit(page, worker, SUBJECTS, {
      [SECOND]: [OTHER_SECTION],
    });
    const blobs = await worker.evaluate(
      async (keys) => {
        // Test only: the extension worker carries the storage global.
        const { local } = (
          globalThis as unknown as {
            chrome: {
              storage: {
                local: {
                  get(k: string[]): Promise<Record<string, unknown>>;
                };
              };
            };
          }
        ).chrome.storage;
        return local.get(keys);
      },
      [ROOT_KEY, REGKIT_KEY],
    );
    return { blobs, term, sections };
  } finally {
    await debug.close();
  }
}

async function store(worker: Worker, blobs: Record<string, unknown>) {
  await worker.evaluate(async (items) => {
    // Test only: the extension worker carries the storage global.
    const { local } = (
      globalThis as unknown as {
        chrome: {
          storage: {
            local: { set(i: Record<string, unknown>): Promise<void> };
          };
        };
      }
    ).chrome.storage;
    await local.set(items);
  }, blobs);
}

async function openReplica(
  context: BrowserContext,
  seeded: Seeded,
  term: { year: string; semester: string } = seeded.term,
  query = '',
): Promise<{ page: Page; root: ClosedRoot }> {
  const page = context.pages()[0] ?? (await context.newPage());
  // The term rides the query too, so the page shows it from its first render.
  const search = new URLSearchParams(query.replace(/^\?/, ''));
  search.set('term', `${term.semester}/${term.year}`);
  await page.goto(`${REPLICA_URL}?${search.toString()}${HASH}`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, catalog }) => {
      window.replica.set({ term: next });
      window.replica.configure({ catalog, xhr: true });
    },
    {
      next: term,
      catalog: Object.fromEntries(
        SUBJECTS.map((id) => [
          id,
          {
            sections: [
              { section: seeded.sections[id] ?? '', kind: 'ท' as const },
              ...(id === SECOND
                ? [{ section: OTHER_SECTION.section, kind: 'ท' as const }]
                : []),
            ],
          },
        ]),
      ),
    },
  );
  const root = await ClosedRoot.attach(page);
  // The card lists the plan once the page term has been read, or offers to make one.
  const ready =
    term.year === seeded.term.year && term.semester === seeded.term.semester
      ? FIRST
      : 'สร้างตาราง';
  await root.waitFor(
    (node) =>
      attr(node, 'id') === 'kcp-regis-card' && textOf(node).includes(ready),
    'helper card for the page term',
  );
  return { page, root };
}

const card = withAttr('id', 'kcp-regis-card');

async function cardAttr(root: ClosedRoot, name: string): Promise<string> {
  const node = await root.waitFor(card, 'helper card');
  return attr(node, name) ?? '';
}

async function untilCard(root: ClosedRoot, name: string, value: string) {
  await expect
    .poll(() => cardAttr(root, name), { timeout: 30_000 })
    .toBe(value);
}

/** Whether the planner overlay is open: it locks the page's scroll while it shows. */
async function overlayOpen(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.style.overflow === 'hidden',
  );
}

/** Turn the observer off for drift: the page's subject id header loses its class. */
async function driftOff(page: Page, root: ClosedRoot): Promise<void> {
  for (let strike = 0; strike < 4; strike += 1) {
    await page.evaluate((n) => {
      const head = document.querySelectorAll('thead th')[1];
      if (head === undefined) throw new Error('no subject id header');
      head.classList.remove('subject-id');
      head.classList.toggle(`drift-${String(n)}`);
    }, strike);
    await page.waitForTimeout(400);
  }
  await untilCard(root, 'data-observer', 'off');
  await page.evaluate(() => {
    document.querySelectorAll('thead th')[1]?.classList.add('subject-id');
  });
  await page.waitForTimeout(400);
  // An off observer stays off on its own, until the student asks again.
  expect(await cardAttr(root, 'data-observer')).toBe('off');
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

/** The part of the page the screen shows, in the page's client pixels. */
function onScreen(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const view = window.visualViewport;
    if (view === null) throw new Error('no visual viewport');
    return {
      left: view.offsetLeft,
      top: view.offsetTop,
      right: view.offsetLeft + view.width,
      bottom: view.offsetTop + view.height,
    };
  });
}

/** A tap lands on any box, shown or not, so a box is checked to lie on screen. */
async function expectOnScreen(page: Page, box: Box, what: string) {
  const screen = await onScreen(page);
  expect(
    box.left >= screen.left - 1 &&
      box.top >= screen.top - 1 &&
      box.right <= screen.right + 1 &&
      box.bottom <= screen.bottom + 1,
    `${what} ${JSON.stringify(box)} lies on screen ${JSON.stringify(screen)}`,
  ).toBe(true);
}

const moreTrigger = withAttr('aria-label', 'เพิ่มเติม');
const menuItem = (words: string) => roleNamed('menuitem', words);
const sectionTrigger = (node: DomNode) =>
  attr(node, 'role') === 'combobox' &&
  attr(node, 'aria-haspopup') === 'listbox';

test('every press in the closed root does what it says on a phone', async ({
  context,
  mock,
  serviceWorker,
}) => {
  test.setTimeout(150_000);
  const seeded = await seedThroughDebug(mock);
  await store(serviceWorker, seeded.blobs);
  const { page, root } = await openReplica(context, seeded);
  mock.clearApiCalls();

  // The first subject is on the page already, so the second is in focus.
  await page.evaluate((id) => {
    window.replica.set({
      list: [{ subjectId: id, section: '901', kind: 'ท' }],
    });
  }, FIRST);

  // A section option chosen with a tap takes, and the section menu closes.
  await root.tap(sectionTrigger, 'section trigger');
  await root.tap(
    (node) =>
      attr(node, 'role') === 'option' &&
      textOf(node).includes(OTHER_SECTION.section),
    'other section option',
  );
  await root.waitGone(withAttr('role', 'listbox'), 'section menu');
  const trigger = await root.waitFor(sectionTrigger, 'section trigger');
  expect(textOf(trigger)).toContain(OTHER_SECTION.section);

  // Add all for me adds every subject still to add, one at a time.
  await root.tap(moreTrigger, 'more trigger');
  await root.waitFor(menuItem('เพิ่มให้ทุกวิชา'), 'Add all item');
  // The press counts once the item has shown for half a second.
  await page.waitForTimeout(700);
  await root.tap(menuItem('เพิ่มให้ทุกวิชา'), 'Add all item');
  await untilCard(root, 'data-fill', 'done');
  const listed = await page.evaluate(() =>
    window.replica.state.list.map((row) => [row.subjectId, row.section]),
  );
  expect(listed.map(([id]) => id)).toEqual([...SUBJECTS]);
  expect(listed[1]).toEqual([SECOND, OTHER_SECTION.section]);
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);

  // Open the planner from the more menu opens the overlay.
  await root.tap(moreTrigger, 'more trigger');
  await root.tap(menuItem('เปิดตารางเรียน'), 'Open the planner item');
  await expect.poll(() => overlayOpen(page)).toBe(true);

  // The planner's header menu closes on a second press of its trigger.
  const headerMore = withAttr('aria-label', 'ตัวเลือกเพิ่มเติม');
  await root.tap(headerMore, 'header more trigger');
  await root.waitFor(withAttr('role', 'menu'), 'header menu');
  await root.tap(headerMore, 'header more trigger');
  await root.waitGone(withAttr('role', 'menu'), 'header menu');
  await expectNothingForbidden(page);
});

test('Check again on the bar and in the more menu reads a drifted page anew', async ({
  context,
  mock,
  serviceWorker,
}) => {
  test.setTimeout(150_000);
  const seeded = await seedThroughDebug(mock);
  await store(serviceWorker, seeded.blobs);
  const { page, root } = await openReplica(context, seeded);
  await untilCard(root, 'data-observer', 'healthy');
  mock.clearApiCalls();

  // A tap on the words of the bar is the Check again the student meant.
  await driftOff(page, root);
  await root.tap(withAttr('id', 'kcp-regis-stale'), 'unreadable words');
  await untilCard(root, 'data-observer', 'healthy');
  await root.waitGone(withAttr('id', 'kcp-regis-stale'), 'unreadable bar');

  // Check again in the more menu does the same.
  await driftOff(page, root);
  await root.tap(moreTrigger, 'more trigger');
  await root.tap(menuItem('ตรวจอีกครั้ง'), 'Check again item');
  await root.waitGone(withAttr('role', 'menu'), 'more menu');
  await untilCard(root, 'data-observer', 'healthy');

  // On a build KCP was not tested with no reading can help, so no control offers one.
  await openReplica(context, seeded, seeded.term, '?build=untested');
  await untilCard(root, 'data-observer', 'off');
  const bar = await root.waitFor(withAttr('id', 'kcp-regis-stale'), 'bar');
  expect(textOf(bar)).toContain('หน้าลงทะเบียนเปลี่ยนรุ่น');
  const offers = await root.findAll(
    (node) =>
      (attr(node, 'role') === 'menuitem' || node.nodeName === 'BUTTON') &&
      textOf(node).includes('ตรวจอีกครั้ง'),
  );
  expect(offers).toEqual([]);
  await root.tap(moreTrigger, 'more trigger');
  await root.waitFor(withAttr('role', 'menu'), 'more menu');
  expect(await root.find(menuItem('ตรวจอีกครั้ง'))).toBeNull();
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);
});

test('the card and the launcher stay on screen, also on a page wider than the phone', async ({
  context,
  mock,
  serviceWorker,
}) => {
  test.setTimeout(150_000);
  const seeded = await seedThroughDebug(mock);
  await store(serviceWorker, seeded.blobs);
  for (const query of ['', '?wide']) {
    const { page, root } = await openReplica(
      context,
      seeded,
      seeded.term,
      query,
    );
    // The replica fits the phone as the host does, and grows past it when asked, when
    // the browser grows the layout viewport the fixed layers resolve against with it.
    const widths = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(widths.map((width) => width > PHONE.width)).toEqual(
      query === '' ? [false, false] : [true, true],
    );
    await expectOnScreen(page, await root.box(card, 'helper card'), 'card');
    const launcher = withAttr('id', 'kcp-launcher');
    await expectOnScreen(
      page,
      await root.box(launcher, 'launcher'),
      'launcher',
    );
    // Collapsed, the launcher stays where the student can press it again.
    await root.tap(launcher, 'launcher');
    await root.waitGone(card, 'helper card');
    await expectOnScreen(
      page,
      await root.box(launcher, 'launcher'),
      'launcher',
    );
    await expectNothingForbidden(page);
  }
});

test('making a plan for a page term with none opens the planner on a tap', async ({
  context,
  mock,
  serviceWorker,
}) => {
  test.setTimeout(150_000);
  const seeded = await seedThroughDebug(mock);
  await store(serviceWorker, seeded.blobs);
  const next = {
    year: String(Number(seeded.term.year) + 1),
    semester: seeded.term.semester,
  };
  const { page, root } = await openReplica(context, seeded, next);
  const label = `สร้างตาราง ${next.semester}/${next.year}`;
  await root.tap(
    (node) => node.nodeName === 'BUTTON' && textOf(node).includes(label),
    'make a plan button',
  );
  await expect.poll(() => overlayOpen(page)).toBe(true);
  await expectNothingForbidden(page);
});
