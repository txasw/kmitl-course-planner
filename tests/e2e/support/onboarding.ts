// The first install state of an end to end context (ADR-0062). Every Playwright launch
// is a fresh profile, so the worker sees an install, opens the search page in a tab of
// its own, and the welcome is due. A spec that is not about the first run settles that
// state: the install tab is closed and the onboarding record is seeded as if the
// student had seen the welcome, opened the panel, and turned the entry prompt off. A
// spec about the first run asks for the fresh state and meets the install as a student
// would.

import type { BrowserContext, Page } from '@playwright/test';
import { SELECTOR_URL } from '../../../src/lib/shell/hostTab';
import { ONBOARDING_KEY } from '../../../src/lib/storage/keys';
import type { OnboardingRecord } from '../../../src/lib/storage/onboarding';
import { extensionWorker } from './worker';

/** Whether a context starts as a fresh install or as a student past the first run. */
export type OnboardingState = 'settled' | 'fresh';

/** The page the worker opens on install, taken from the product so the two agree. */
export const INSTALL_TAB_URL = SELECTOR_URL;

// Long enough for a cold browser to install the extension and open the tab, short
// enough that a broken install handler fails each spec with a clear error instead of
// running into the spec timeout.
const INSTALL_TAB_TIMEOUT_MS = 10_000;
const POLL_MS = 100;

const SETTLED_AT = '2026-11-06T08:00:00.000Z';

// The first run as done: the welcome seen, the panel opened, the entry prompt off.
const SETTLED_RECORD: OnboardingRecord = {
  schemaVersion: 1,
  welcomeShownAt: SETTLED_AT,
  panelFirstOpenedAt: SETTLED_AT,
  entryToastOptOutAt: SETTLED_AT,
};

// The worker exposes the extension API as a global; the harness describes only the
// part it calls.
interface WorkerGlobals {
  chrome: {
    storage: { local: { set(items: Record<string, unknown>): Promise<void> } };
  };
}

function findInstallTab(context: BrowserContext): Page | undefined {
  return context.pages().find((page) => page.url() === INSTALL_TAB_URL);
}

/**
 * Resolves the tab the worker opened on install. The tab may already exist when the
 * context is handed over, so the open pages are checked before waiting for a new one;
 * a new tab reports its URL only once its navigation commits, so the check repeats.
 */
export async function waitForInstallTab(
  context: BrowserContext,
): Promise<Page> {
  const deadline = Date.now() + INSTALL_TAB_TIMEOUT_MS;
  for (;;) {
    const tab = findInstallTab(context);
    if (tab !== undefined) return tab;
    const left = deadline - Date.now();
    if (left <= 0) {
      throw new Error(
        `The install tab at ${INSTALL_TAB_URL} did not open within ${String(INSTALL_TAB_TIMEOUT_MS)} ms. Check the runtime.onInstalled handler in the background worker.`,
      );
    }
    await context
      .waitForEvent('page', { timeout: Math.min(left, POLL_MS) })
      .catch(() => undefined);
  }
}

/**
 * Closes the install tab, then seeds the onboarding record through the worker. This is
 * a test harness write: in the product only the content side writes the record.
 * Closing first means the install tab cannot write the record after the seed.
 */
export async function settleOnboarding(context: BrowserContext): Promise<void> {
  const tab = await waitForInstallTab(context);
  await tab.close();
  const worker = await extensionWorker(context);
  await worker.evaluate(
    async ({ key, record }) => {
      // Test only assertion: an extension worker carries the global described above.
      const globals = globalThis as unknown as WorkerGlobals;
      await globals.chrome.storage.local.set({ [key]: record });
    },
    { key: ONBOARDING_KEY, record: SETTLED_RECORD },
  );
}
