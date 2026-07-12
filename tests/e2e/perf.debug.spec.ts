// Performance profiling against the synthetic dense catalog. This is the profiled
// run the Phase 8 acceptance names: it loads a 500 section catalog, then measures
// the script time three interactions cost through the Chrome DevTools Protocol
// Performance metrics. ScriptDuration is cumulative, so a delta across one
// interaction is the main thread script time that interaction spent, which is what
// memoizing the block and card cuts. Headless Chromium does not composite at a real
// refresh rate, so a frame counter would not reflect a real display; the script time
// the render costs is the honest, machine comparable signal, and the render count
// unit tests are the deterministic guard that the memoization holds.
//
// The numbers print with a [perf] prefix for the run report. The assertions are loose
// upper bounds that only catch a gross regression, since absolute timings vary by
// machine; the memoization is proven by the unit tests, not by a tight timing here.

import { test, expect, openPlanner } from './support/fixtures';
import { FAT_COURSE_ID, denseSubjectId } from './support/denseCatalog';
import type { Page, BrowserContext } from '@playwright/test';

const DENSE_SUBJECT_ID = '90000500';
// The real 499 row by_subject_id capture, which dedupes to 44 unique sections. Served
// for this reserved id so the real normalize path is measured, not only the synthetic
// dense catalog.
const REAL_SUBJECT_ID = '90000499';
// A subject id present in the real capture, used to confirm its catalog rendered.
const REAL_COURSE_ID = '90641007';
const PLAN_SIZE = 12;

interface Metric {
  name: string;
  value: number;
}
interface MetricsResponse {
  metrics: Metric[];
}

/** A minimal CDP client surface: send a command and read the metrics list. */
interface Cdp {
  send: (method: string) => Promise<unknown>;
}

async function scriptMs(client: Cdp): Promise<number> {
  // The CDP getMetrics reply is untyped in the Playwright surface, so narrow it to the
  // one field this reads; a malformed reply falls back to zero rather than throwing.
  const response = (await client.send('Performance.getMetrics')) as
    MetricsResponse | undefined;
  const metric = response?.metrics.find((m) => m.name === 'ScriptDuration');
  return (metric?.value ?? 0) * 1000;
}

/** Open a CDP session narrowed to the send surface this spec uses. The double cast
 * bridges the Playwright CDPSession type to the minimal Cdp shape, since only send is
 * called and only for the Performance domain. */
async function openCdp(context: BrowserContext, page: Page): Promise<Cdp> {
  const client = (await context.newCDPSession(page)) as unknown as Cdp;
  await client.send('Performance.enable');
  return client;
}

/** Run the by subject id search for a reserved id and wait for its first card. */
async function searchDense(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill(DENSE_SUBJECT_ID);
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(
    page.getByText(denseSubjectId(0), { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
}

/** Add one single section course to the plan by its subject id. */
async function addBySubject(page: Page, subjectId: string): Promise<void> {
  await page
    .getByRole('article')
    .filter({ hasText: subjectId })
    .first()
    .getByRole('button', { name: 'เพิ่ม', exact: true })
    .first()
    .click();
}

const blockSel = (id: string): string => `[data-teach-table-id="${id}"]`;

test('profiles the dense catalog render and a grid drag', async ({
  context,
}: {
  context: BrowserContext;
}) => {
  const page = await openPlanner(context);
  const client = await openCdp(context, page);

  // Mount: search the dense id and render the full catalog.
  const beforeMount = await scriptMs(client);
  await searchDense(page);
  await expect(
    page.getByText(denseSubjectId(PLAN_SIZE), { exact: true }).first(),
  ).toBeVisible();
  const mountMs = (await scriptMs(client)) - beforeMount;

  // Add: one add re-renders the catalog because the plan changed. Measured first,
  // clean of any preceding interaction, so the number is the honest cost of a 500
  // card re-render. Memoizing a card cannot cut this, because the plan change alters
  // every card's placement input, so it is reported as a cost, not a win.
  const beforeAdd = await scriptMs(client);
  await addBySubject(page, denseSubjectId(0));
  await expect(page.locator(blockSel('700000'))).toBeVisible();
  const addMs = (await scriptMs(client)) - beforeAdd;

  // Filter toggle that drops nothing: every section survives, so filterCourses
  // returns identical course identities and a memoized card skips its re-render.
  // This is the clearest memoization win, a re-filter of 500 cards that no longer
  // re-renders any of them. The hide toggles live in the filter popover, so open it
  // first; that render lands before the measurement window and is not counted.
  await page.getByRole('button', { name: 'ตัวกรอง', exact: true }).click();
  const filterToggle = page
    .getByRole('switch', { name: 'ซ่อนวิชาที่ไม่มีคาบเรียน' })
    .first();
  const beforeFilter = await scriptMs(client);
  await filterToggle.click();
  await page.waitForTimeout(150);
  const filterMs = (await scriptMs(client)) - beforeFilter;
  await filterToggle.click();
  await page.waitForTimeout(150);
  // Close the popover so it does not overlay the catalog for the following adds.
  await page.getByRole('button', { name: 'ตัวกรอง', exact: true }).click();

  // Build out the rest of a dense conflict free plan for the drag, from the first
  // non conflicting slots.
  for (let i = 1; i < PLAN_SIZE; i++) {
    await addBySubject(page, denseSubjectId(i));
  }
  await expect(page.locator(blockSel('700000'))).toBeVisible();
  await expect(
    page.locator(blockSel(String(700000 + PLAN_SIZE - 1))),
  ).toBeVisible();

  // Drag: a course drag of the fat course paints its sections as candidates across
  // the grid; sweeping the pointer changes the raised candidate repeatedly, so the
  // grid re-renders once per hover and re-maps every placed block. This is the drag
  // whose per hover cost memoizing the block removes.
  const grip = page
    .getByRole('article')
    .filter({ hasText: FAT_COURSE_ID })
    .first()
    .locator('[title*="ลากรายวิชา"]')
    .first();
  const gripBox = await grip.boundingBox();
  const fromBox = await page.locator(blockSel('700000')).boundingBox();
  const toBox = await page
    .locator(blockSel(String(700000 + PLAN_SIZE - 1)))
    .boundingBox();
  expect(gripBox).not.toBeNull();
  expect(fromBox).not.toBeNull();
  expect(toBox).not.toBeNull();
  if (gripBox === null || fromBox === null || toBox === null) return;

  const beforeDrag = await scriptMs(client);
  await page.mouse.move(
    gripBox.x + gripBox.width / 2,
    gripBox.y + gripBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(gripBox.x + 24, gripBox.y + 12, { steps: 6 });
  // Sweep back and forth across the grid so the raised candidate keeps changing.
  const y = fromBox.y + fromBox.height / 2;
  for (let pass = 0; pass < 3; pass++) {
    await page.mouse.move(fromBox.x + 4, y, { steps: 12 });
    await page.mouse.move(toBox.x + toBox.width - 4, y, { steps: 12 });
  }
  // End the sweep off the grid, over the top left chrome, so the drop resolves to no
  // drop zone and commits nothing whatever the sweep path was. The measurement above
  // already captured the re-renders the sweep caused.
  await page.mouse.move(5, 5, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const dragMs = (await scriptMs(client)) - beforeDrag;

  // Nothing committed: the placed plan is unchanged and no fat course block was added.
  await expect(page.locator(blockSel('700000'))).toBeVisible();
  await expect(page.locator('[data-teach-table-id^="790"]')).toHaveCount(0);

  console.log(
    `[perf] mount=${mountMs.toFixed(1)}ms filter=${filterMs.toFixed(1)}ms add=${addMs.toFixed(1)}ms drag=${dragMs.toFixed(1)}ms plan=${String(PLAN_SIZE)} catalog=500`,
  );

  // Loose ceilings: a gross regression trips these, machine variance does not. The
  // measured values sit far below, so the headroom absorbs a slow contended runner.
  expect(mountMs).toBeGreaterThan(0);
  expect(filterMs).toBeLessThan(3000);
  expect(addMs).toBeLessThan(6000);
  expect(dragMs).toBeLessThan(8000);
});

test('profiles the real capture normalize and render', async ({
  context,
}: {
  context: BrowserContext;
}) => {
  const page = await openPlanner(context);
  const client = await openCdp(context, page);

  // The real 499 row capture: this exercises the true normalize path, 499 raw rows
  // validated and deduped to 44 sections, and renders that real catalog, which the
  // synthetic dense set cannot stand in for.
  const before = await scriptMs(client);
  await page.getByRole('button', { name: 'รหัสวิชา' }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill(REAL_SUBJECT_ID);
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await expect(
    page.getByText(REAL_COURSE_ID, { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
  const realMs = (await scriptMs(client)) - before;

  console.log(`[perf] realCapture=${realMs.toFixed(1)}ms rows=499 unique=44`);
  expect(realMs).toBeGreaterThan(0);
});
