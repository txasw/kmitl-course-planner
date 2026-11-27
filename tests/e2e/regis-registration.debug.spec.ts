import type { Page } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import type { MockServer } from './support/mockServer';
import { planWithKit } from './support/regisKit';
import type { Replica } from './host/pre_registration/replica.js';
import type {
  RegistrationReplica,
  RegistrationState,
} from './host/registration/replica.js';

// KCP on the regular registration page stays at L0: the helper card and the manual
// checklist only. It reads nothing on the page, fills nothing, sends no host build check
// request, and sends no request of any kind. The regular registration replica is written
// by hand and modelled on the host build of 2026-11-23 only: the choose subjects step
// with its add card, whose heading carries no (ล่วงหน้า) span, the summary with the add,
// change, and withdraw area and the queue panel, and the closed page. Each page is served
// under a build name the host check would verify on pre registration, so a check sent here
// would show as a script read. Every host control counts its clicks. A second case loads
// the route over the pre registration replica, whose add card does carry the span.

declare global {
  interface Window {
    replica: Replica;
    registrationReplica: RegistrationReplica;
  }
}

const REGISTRATION_URL = `${REGIS_ORIGIN}/replica/registration`;
const PRE_REGISTRATION_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const SUBJECTS = ['90000001', '90000003'] as const;
const OTHER_PAGE = 'เพิ่มให้ใช้ได้ในหน้าลงทะเบียนล่วงหน้า กรอกรหัสวิชาจากเช็กลิสต์';
const NOT_READ = 'KCP ไม่อ่านข้อมูลจากหน้านี้';
const STATES: readonly RegistrationState[] = [
  'REGIS',
  'SUMMARY_REGIS',
  'closed',
];

async function expectQuietHelper(page: Page, mock: MockServer): Promise<void> {
  const card = page.locator('#kcp-regis-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-observer', 'waiting');
  const add = card.getByRole('button', { name: 'เพิ่มให้', exact: true });
  await expect(add).toHaveAttribute('aria-disabled', 'true');
  await expect(add).toHaveAccessibleDescription(OTHER_PAGE);
  await expect(card.locator('[data-helper-plan-term]')).toContainText(NOT_READ);
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  // Long enough for any check, observer reading, or request to have started.
  await page.waitForTimeout(1500);
  await expect(card).toHaveAttribute('data-observer', 'waiting');
  await expect(page.locator('[data-fill-press]')).toHaveCount(0);
  expect(mock.scriptReads()).toEqual([]);
  expect(mock.apiCalls()).toEqual([]);
}

for (const state of STATES) {
  test(`stays at L0 on the regular registration page in state ${state}`, async ({
    context,
    mock,
    serviceWorker,
  }) => {
    const page = await openPlanner(context);
    const { term } = await planWithKit(page, serviceWorker, SUBJECTS);
    mock.clearApiCalls();
    await page.goto(
      `${REGISTRATION_URL}?build=verified&state=${state}&term=${term.semester}/${term.year}#/registration`,
    );
    await page.waitForFunction(() => 'registrationReplica' in window);
    await expectQuietHelper(page, mock);
    // A press of the blocked Add for me only shows its reason; nothing reaches the page.
    await page
      .locator('#kcp-regis-card')
      .getByRole('button', { name: 'เพิ่มให้', exact: true })
      .click({ force: true });
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => ({
        clicks: window.registrationReplica.counters.clicks,
        interactions: window.registrationReplica.interactions(),
      })),
    ).toEqual({ clicks: {}, interactions: 0 });
    expect(mock.apiCalls()).toEqual([]);
  });
}

test('stays at L0 on the registration route over the pre registration markup', async ({
  context,
  mock,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  await planWithKit(page, serviceWorker, SUBJECTS);
  mock.clearApiCalls();
  await page.goto(`${PRE_REGISTRATION_URL}?build=verified#/registration`);
  await page.waitForFunction(() => 'replica' in window);
  await expectQuietHelper(page, mock);
  expect(
    await page.evaluate(() => ({
      clicks: window.replica.counters.clicks,
      interactions: window.replica.interactions(),
      forbidden: window.replica.forbidden(),
      writes: window.replica.counters.writes,
      reads: window.replica.counters.reads,
    })),
  ).toEqual({ clicks: {}, interactions: 0, forbidden: 0, writes: 0, reads: 0 });
});
