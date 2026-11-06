// Decides what the worker does when the browser reports an install event (ADR-0062).
// Only a first install counts: the worker writes the install record, and when this call
// created it and both host origins are granted, it opens the search page and records a
// welcome intent for the new tab, so the welcome shows there rather than in a regis tab
// that was already open. A repeated install event, such as a Firefox temporary reload,
// finds the record and opens nothing. Without host access the page would load without
// the planner and read as broken, so no tab opens; the welcome then shows on the first
// visible regis visit after access is granted. Updates of the extension, the browser,
// or a shared module write nothing, so existing users see no welcome. Every browser
// call is injected, so the decision is unit tested without a browser.

import type { InstallRepository } from '../storage/install';
import type { TabIntentStore } from '../storage/tabIntents';
import { SELECTOR_URL } from './hostTab';

/** The part of the install event details the handler reads. */
export interface InstalledDetails {
  reason: string;
}

/** What an install event did, for the tests. */
export type InstalledOutcome = 'ignored' | 'recorded' | 'opened';

export interface InstalledDeps {
  /** The worker owned install record. */
  install: Pick<InstallRepository, 'record'>;
  /** The extension version stored with the record. */
  version: string;
  /** Resolves whether both host origins are granted. */
  hasHostAccess: () => Promise<boolean>;
  /** Opens a tab at the URL and resolves its id, or null when the browser gave none. */
  createTab: (url: string) => Promise<number | null>;
  /** The worker's tab intent store, or null where storage.session is missing. */
  intents: TabIntentStore | null;
}

async function firstInstall(
  deps: InstalledDeps,
  markWelcome: (tabId: number) => Promise<void>,
): Promise<InstalledOutcome> {
  const { created } = await deps.install.record(deps.version);
  if (!created) return 'ignored';
  if (!(await deps.hasHostAccess().catch(() => false))) return 'recorded';
  const tabId = await deps.createTab(SELECTOR_URL);
  if (tabId !== null) {
    // A session area that cannot be written still leaves the tab open, and its claim
    // is then granted as the first to ask.
    await markWelcome(tabId).catch(() => undefined);
  }
  return 'opened';
}

export async function handleInstalled(
  details: InstalledDetails,
  deps: InstalledDeps,
): Promise<InstalledOutcome> {
  if (details.reason !== 'install') return 'ignored';
  const { intents } = deps;
  if (intents === null) {
    // With no session area the claim is granted to the first visible tab that asks,
    // which on a fresh install is this one.
    return firstInstall(deps, () => Promise.resolve());
  }
  // The whole decision runs as one queued step, from the record write to the intent.
  // A content script learns of the install by reading the record, so any claim it
  // sends, from the new tab or from a regis tab Firefox injected into on install,
  // waits for the step and finds the intent already recorded.
  return intents.run((operations) =>
    firstInstall(deps, (tabId) => operations.add(tabId, 'welcome')),
  );
}
