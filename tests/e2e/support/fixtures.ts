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

  context: async ({ extensionDir, mock }, use) => {
    if (extensionDir === '') {
      throw new Error('extensionDir option is not set for this project');
    }
    const dir = resolve(extensionDir);
    const context = await chromium.launchPersistentContext('', {
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
  await page.getByRole('button', { name: 'เปิด KMITL Course Planner' }).click();
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
