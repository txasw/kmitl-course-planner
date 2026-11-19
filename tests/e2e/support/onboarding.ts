// The first install state of an end to end context (ADR-0062). Every Playwright launch
// is a fresh profile, so the worker sees an install, opens the search page in a tab of
// its own, and the welcome is due. A spec that is not about the first run settles that
// state: the install tab is closed and the onboarding record is seeded as if the
// student had seen the welcome, opened the panel, turned the entry prompt off, and
// chosen not again today on the search page coach mark (ADR-0072). A spec about the
// first run asks for the fresh state and meets the install as a student would, a spec
// about the entry prompt turns it back on before it loads a page, and a spec about the
// coach mark lets it speak again.

import type { BrowserContext, Page } from '@playwright/test';
import { SELECTOR_URL } from '../../../src/lib/shell/hostTab';
import { ONBOARDING_KEY } from '../../../src/lib/storage/keys';
import type { OnboardingRecord } from '../../../src/lib/storage/onboarding';
import { localDayStamp } from '../../../src/lib/onboarding/coachMark';
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

// The first run as done: the welcome seen and the panel opened.
const FIRST_RUN_DONE: OnboardingRecord = {
  schemaVersion: 1,
  welcomeShownAt: SETTLED_AT,
  panelFirstOpenedAt: SETTLED_AT,
};

// The day the harness runs on, in the same local zone the browser it launches reads.
function today(): string {
  return localDayStamp(new Date());
}

// The first run as done with the entry prompt still on. The coach mark stays away for
// the day, so on the search page the entry prompt speaks rather than giving way to it.
function promptedRecord(): OnboardingRecord {
  return { ...FIRST_RUN_DONE, coachMarkSnoozedOn: today() };
}

// The first run as done with the coach mark free to speak and the entry prompt off.
const COACHED_RECORD: OnboardingRecord = {
  ...FIRST_RUN_DONE,
  entryToastOptOutAt: SETTLED_AT,
};

// The first run as done: the entry prompt off, the coach mark away for the day.
function settledRecord(): OnboardingRecord {
  return { ...COACHED_RECORD, coachMarkSnoozedOn: today() };
}

// The worker exposes the extension API as a global; the harness describes only the
// part it calls.
interface WorkerGlobals {
  chrome: {
    storage: {
      local: {
        get(key: string): Promise<Record<string, unknown>>;
        set(items: Record<string, unknown>): Promise<void>;
      };
    };
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
  await seedOnboarding(context, settledRecord());
}

/**
 * Turns the entry prompt back on in a settled context, as for a student who has not
 * opted out, so the next page a spec loads may show it. A test harness write, like the
 * seed it replaces.
 */
export async function allowEntryToast(context: BrowserContext): Promise<void> {
  await seedOnboarding(context, promptedRecord());
}

/**
 * Lets the search page coach mark speak again in a settled context, as for a student
 * who has not chosen not again today. The entry prompt stays off unless asked for, for
 * a spec about which of the two speaks. A test harness write, like the seed it replaces.
 */
export async function allowCoachMark(
  context: BrowserContext,
  { entryToast = false }: { entryToast?: boolean } = {},
): Promise<void> {
  await seedOnboarding(context, entryToast ? FIRST_RUN_DONE : COACHED_RECORD);
}

async function seedOnboarding(
  context: BrowserContext,
  record: OnboardingRecord,
): Promise<void> {
  await seedStorage(context, ONBOARDING_KEY, record);
}

/**
 * Writes one storage.local key through the worker, such as the preferences a spec loads
 * a page under. A test harness write: in the product only the owning side writes a key.
 */
export async function seedStorage(
  context: BrowserContext,
  key: string,
  value: unknown,
): Promise<void> {
  const worker = await extensionWorker(context);
  await worker.evaluate(
    async (items) => {
      // Test only assertion: an extension worker carries the global described above.
      const globals = globalThis as unknown as WorkerGlobals;
      await globals.chrome.storage.local.set(items);
    },
    { [key]: value },
  );
}

/** The stored onboarding record as the worker reads it, unvalidated. */
export async function storedOnboarding(
  context: BrowserContext,
): Promise<unknown> {
  const worker = await extensionWorker(context);
  return worker.evaluate(async (key) => {
    // Test only assertion: an extension worker carries the global described above.
    const globals = globalThis as unknown as WorkerGlobals;
    const items = await globals.chrome.storage.local.get(key);
    return items[key];
  }, ONBOARDING_KEY);
}
