import type { Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { planWithKit } from './support/regisKit';
import type { Replica } from './host/pre_registration/replica.js';

// The host check on the replica (ADR-0079). The page is served under app script names KCP
// was never tested with, beside the tested vendor script. The worker reads the app script
// once by its exact name, which the mock serves as KCP's replica bundle: under the
// verified name its parts are the ones the debug build records, so the observer reads
// the page and Add for me fills; under the changed name one label differs, so the helper
// keeps today's untested build bar, fill stays off, and the debug line names the part.
// Each build is read once: a second visit answers from what the worker kept. The page
// itself is the same behaviour replica either way, and nothing is pressed but Add for me.

declare global {
  interface Window {
    replica: Replica;
  }
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const SUBJECT = '90000001';

async function openBuild(
  page: Page,
  serviceWorker: Worker,
  build: 'verified' | 'changed' | 'untested',
): Promise<{ term: { year: string; semester: string }; section: string }> {
  const { term, sections } = await planWithKit(page, serviceWorker, [SUBJECT]);
  const section = sections[SUBJECT] ?? '';
  await visit(page, build, term, section);
  return { term, section };
}

async function visit(
  page: Page,
  build: string,
  term: { year: string; semester: string },
  section: string,
  reload = false,
): Promise<void> {
  // A second visit reloads the page, since a navigation to the same address with its hash
  // would keep the document and its list.
  if (reload) await page.reload();
  else await page.goto(`${REPLICA_URL}?build=${build}${HASH}`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, options }) => {
      window.replica.set({ term: next });
      window.replica.configure({ ...options, xhr: true });
    },
    {
      next: term,
      options: {
        catalog: { [SUBJECT]: { sections: [{ section, kind: 'ท' as const }] } },
      },
    },
  );
  await expect(page.locator('#kcp-regis-card')).toBeVisible();
}

function addForMe(page: Page) {
  return page
    .getByRole('button', { name: 'เพิ่มให้', exact: true })
    .and(page.locator('[data-fill-press]'));
}

async function expectNothingForbidden(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => ({
      forbidden: window.replica.forbidden(),
      writes: window.replica.counters.writes,
    })),
  ).toEqual({ forbidden: 0, writes: 0 });
}

test('turns fill on for an untested name whose parts match a tested build', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const { term, section } = await openBuild(page, serviceWorker, 'verified');
  await expect(addForMe(page)).toBeVisible();
  await expect(page.locator('[data-observer="off"]')).toHaveCount(0);
  expect(mock.scriptReads()).toEqual(['/js/app.c0ffee01.js']);

  mock.clearApiCalls();
  await page.waitForTimeout(700);
  await addForMe(page).click();
  await expect(page.locator('[data-fill="done"]')).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate(() =>
      window.replica.state.list.map((row) => `${row.subjectId} ${row.section}`),
    ),
  ).toEqual([`${SUBJECT} ${section}`]);
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);

  // A second visit to the same build answers from what the worker kept.
  await visit(page, 'verified', term, section, true);
  await expect(addForMe(page)).toBeVisible();
  expect(mock.scriptReads()).toEqual(['/js/app.c0ffee01.js']);
});

test('keeps fill off when a part differs and names it in the debug line', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const { term, section } = await openBuild(page, serviceWorker, 'changed');
  mock.clearApiCalls();
  await expect(page.locator('[data-observer="off"]')).toContainText(
    'หน้าลงทะเบียนเปลี่ยนรุ่น',
  );
  await expect(page.getByTestId('kcp-host-check')).toHaveText(
    'Host check: parts differ from the closest tested build: labels',
  );
  await expect(
    page.getByRole('button', { name: 'เพิ่มให้', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  expect(await page.evaluate(() => window.replica.interactions())).toBe(0);
  expect(mock.scriptReads()).toEqual(['/js/app.c0ffee02.js']);

  // The mismatch is kept too, so the same build is never read again.
  await visit(page, 'changed', term, section, true);
  await expect(page.locator('[data-observer="off"]')).toBeVisible();
  expect(mock.scriptReads()).toEqual(['/js/app.c0ffee02.js']);
  expect(mock.apiCalls()).toEqual([]);
});

test('keeps fill off on a script with no parts and says it could not be read', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await openBuild(page, serviceWorker, 'untested');
  await expect(page.locator('[data-observer="off"]')).toContainText(
    'หน้าลงทะเบียนเปลี่ยนรุ่น',
  );
  await expect(page.getByTestId('kcp-host-check')).toHaveText(
    'Host check: the app script could not be read',
  );
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  expect(mock.scriptReads()).toEqual(['/js/app.00000000.js']);
});

test('names the pre registration page on regular registration and reads no script', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await planWithKit(page, serviceWorker, [SUBJECT]);
  mock.clearApiCalls();
  // The verified build would turn fill on at pre registration, but regular registration
  // never runs the host check, so Add for me names the page rather than a check that
  // never comes.
  await page.goto(`${REPLICA_URL}?build=verified#/registration`);
  await page.waitForFunction(() => 'replica' in window);
  const card = page.locator('#kcp-regis-card');
  await expect(card).toBeVisible();
  const add = card.getByRole('button', { name: 'เพิ่มให้', exact: true });
  await expect(add).toHaveAttribute('aria-disabled', 'true');
  await expect(add).toHaveAccessibleDescription(
    'เพิ่มให้ใช้ได้ในหน้าลงทะเบียนล่วงหน้า กรอกรหัสวิชาจากเช็กลิสต์',
  );
  await expect(card.getByText('KCP กำลังตรวจรุ่นของหน้านี้')).toHaveCount(0);
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect(mock.scriptReads()).toEqual([]);
  expect(mock.apiCalls()).toEqual([]);
  expect(await page.evaluate(() => window.replica.interactions())).toBe(0);
});

test('keeps fill off after moving from pre registration to regular registration', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await openBuild(page, serviceWorker, 'verified');
  await expect(addForMe(page)).toBeVisible();
  mock.clearApiCalls();
  // The verified build stands for the document, so only the route keeps fill off here.
  await page.evaluate(() => {
    window.location.hash = '#/registration';
  });
  const card = page.locator('#kcp-regis-card');
  const add = card.getByRole('button', { name: 'เพิ่มให้', exact: true });
  await expect(add).toHaveAttribute('aria-disabled', 'true');
  await expect(add).toHaveAccessibleDescription(
    'เพิ่มให้ใช้ได้ในหน้าลงทะเบียนล่วงหน้า กรอกรหัสวิชาจากเช็กลิสต์',
  );
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  // The button is aria disabled, so the press is forced past the actionability wait.
  await add.click({ force: true });
  await page.waitForTimeout(1000);
  await expect(card).toHaveAttribute('data-fill', 'idle');
  expect(await page.evaluate(() => window.replica.interactions())).toBe(0);
  await expectNothingForbidden(page);
  expect(mock.apiCalls()).toEqual([]);
});
