// Playwright fixtures that load the built extension against the in process mock
// server. The extension directory is a per project option, so the same specs run
// against the debug (open shadow root) build for locator access and the
// production (closed root) build for the isolation assertions. The chromium
// channel runs the extension in headless mode, so no display server is needed.

import { test as base, chromium } from '@playwright/test';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { resolve } from 'node:path';
import { startMockServer, type MockServer } from './mockServer';

export interface TestOptions {
  /** Absolute or relative path to the built extension directory to load. */
  extensionDir: string;
}

interface Fixtures extends TestOptions {
  mock: MockServer;
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

export const test = base.extend<Fixtures>({
  extensionDir: ['', { option: true }],

  mock: async ({}, use) => {
    const mock = await startMockServer();
    await use(mock);
    await mock.close();
  },

  context: async (
    { extensionDir, mock, viewport, isMobile, hasTouch, deviceScaleFactor },
    use,
  ) => {
    if (extensionDir === '') {
      throw new Error('extensionDir option is not set for this project');
    }
    const dir = resolve(extensionDir);
    // The device options are passed on by hand so the emulated screen of each
    // project is stated where the context is built, rather than depending on the
    // runner applying its defaults to a context this fixture launches itself.
    const context = await chromium.launchPersistentContext('', {
      viewport,
      isMobile,
      hasTouch,
      ...(deviceScaleFactor !== undefined ? { deviceScaleFactor } : {}),
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${dir}`,
        `--load-extension=${dir}`,
        `--host-resolver-rules=MAP regis.reg.kmitl.ac.th 127.0.0.1:${String(mock.port)}, MAP api.reg.kmitl.ac.th 127.0.0.1:${String(mock.port)}`,
        '--ignore-certificate-errors',
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const existing = context.serviceWorkers();
    const worker = existing[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

/** The host route the content script injects on. */
export const SELECTOR_URL =
  'https://regis.reg.kmitl.ac.th/#/teach_table_selector';

/** Navigate the context's page to the host selector route. */
export async function gotoSelector(context: BrowserContext): Promise<Page> {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(SELECTOR_URL);
  return page;
}

/** Open the planner overlay from the launcher and return the page. */
export async function openPlanner(context: BrowserContext): Promise<Page> {
  const page = await gotoSelector(context);
  await page
    .getByRole('button', { name: 'เปิด Course Planner for KMITL' })
    .click();
  return page;
}

/**
 * Choose an option in a searchable combobox by opening it, optionally typing to
 * filter, then confirming the highlighted option with Enter. Without a filter it
 * confirms the first option.
 */
export async function pickOption(
  page: Page,
  comboName: string,
  filter?: string,
): Promise<void> {
  const combo = page.getByRole('combobox', { name: comboName });
  await combo.click();
  if (filter !== undefined) {
    // Typing highlights the first match; Enter confirms it.
    await combo.fill(filter);
  } else {
    // With no filter nothing is highlighted yet, so move onto the first option.
    await combo.press('ArrowDown');
  }
  await combo.press('Enter');
}

/**
 * Reopen the search form from the summary bar. A submit folds the form, so a spec that
 * runs a second search in the same page opens it first, as a student would.
 */
export async function editSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'แก้ไขการค้นหา' }).click();
}

/**
 * Wait until the results accept pointer input again after a submit. The guard outlasts
 * the form fold, so a raw pointer sequence that measures a row first measures it where
 * it settles.
 */
export async function waitForResultsInput(page: Page): Promise<void> {
  await expect(page.locator('[data-input-guard="on"]')).toHaveCount(0);
}

/**
 * Open a collapsed course card so its section rows mount. A card is collapsed by
 * default unless it is the only course in the result, so a spec that adds from the
 * rows of a multi course result opens the card first; an open card is left as is.
 */
export async function expandCourse(
  page: Page,
  subjectId: string,
): Promise<void> {
  const toggle = page
    .getByRole('article')
    .filter({ hasText: subjectId })
    .first()
    .locator('[data-course-toggle]');
  if ((await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await catalogAtRest(page);
}

/**
 * Wait until no course card is opening or closing and the catalog scroller rests. A
 * card animates its height and an expand scrolls it into view once the open settles,
 * so a spec waits for this before it reads a row's position for a drag.
 */
export async function catalogAtRest(page: Page): Promise<void> {
  await expect(
    page.locator(
      '[data-course-body][data-stage="entering"], [data-course-body][data-stage="leaving"]',
    ),
  ).toHaveCount(0);
  await page.locator('[data-catalog-scroller]').evaluate(
    (scroller) =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        let last = -1;
        let still = 0;
        const tick = (): void => {
          const top = scroller.scrollTop;
          still = top === last ? still + 1 : 0;
          last = top;
          const elapsed = performance.now() - start;
          if ((elapsed > 300 && still >= 5) || elapsed > 3000) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}
