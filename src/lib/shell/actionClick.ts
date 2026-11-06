// Decides what a toolbar icon click or the open shortcut does (ADR-0062). The worker
// cannot read the URL of the clicked tab without the tabs permission, so it asks the
// tab instead: only this extension's content script can acknowledge the open command,
// and a valid acknowledgement means the panel opened there. When nothing answers, the
// worker brings forward the regis tab it opened moments ago for an earlier click, or
// opens the search page and records that the new tab should open the panel when its
// content script mounts. Every browser call is injected, so the order of calls,
// including the Firefox user gesture rule, is unit tested without a browser.

import {
  contentAckSchema,
  type ContentMessage,
} from '../messaging/contentProtocol';
import { isTabId } from '../messaging/router';
import type { TabIntentStore } from '../storage/tabIntents';
import { SELECTOR_URL } from './hostTab';

/** The part of the clicked tab the handler reads. */
export interface ClickedTab {
  id?: number | undefined;
}

/** What a click did, for the debug handle and the tests. */
export type ActionClickOutcome =
  'declined' | 'delivered' | 'activated' | 'created';

export interface ActionClickDeps {
  /**
   * Asks for both host origins, on Firefox only, and resolves whether they are granted.
   * Null on Chrome, which grants host access at install or through its own site access
   * menu.
   */
  requestHostAccess: (() => Promise<boolean>) | null;
  /** Sends a command to the content script of a tab and resolves its raw reply. */
  sendToTab: (tabId: number, message: ContentMessage) => Promise<unknown>;
  /** Brings a tab and its window to the front; false when the tab no longer exists. */
  activateTab: (tabId: number) => Promise<boolean>;
  /** Opens a tab at the URL and resolves its id, or null when the browser gave none. */
  createTab: (url: string) => Promise<number | null>;
  /** The worker's tab intent store, or null where storage.session is missing. */
  intents: TabIntentStore | null;
}

const OPEN_PANEL: ContentMessage = { type: 'shell/openPanel' };

// A rejected send means no receiver: a tab on another site, a regis tab that loaded
// before install, or a browser page. A reply that fails the schema counts the same,
// since it did not come from this extension's content script.
async function deliver(deps: ActionClickDeps, tabId: number): Promise<boolean> {
  try {
    return contentAckSchema.safeParse(await deps.sendToTab(tabId, OPEN_PANEL))
      .success;
  } catch {
    return false;
  }
}

export async function handleActionClick(
  tab: ClickedTab,
  deps: ActionClickDeps,
): Promise<ActionClickOutcome> {
  // Firefox honours a permission request only from a user gesture, and the gesture
  // ends at the first await, so the request is started before anything else runs.
  const access = deps.requestHostAccess ? deps.requestHostAccess() : null;
  if (access !== null && !(await access.catch(() => false))) {
    return 'declined';
  }
  if (isTabId(tab.id) && (await deliver(deps, tab.id))) {
    return 'delivered';
  }
  const { intents } = deps;
  if (intents === null) {
    // With no session area there is nowhere to keep the intent, so the new tab opens
    // without the panel opening by itself.
    await deps.createTab(SELECTOR_URL);
    return 'created';
  }
  // Creating the tab and recording its intent run as one queued step, so a content
  // script that mounts quickly asks for its intent only after it exists. A session
  // area that cannot be read or written degrades to the same open as no session
  // area, so a storage fault never leaves the click doing nothing.
  return intents.run(async (operations) => {
    const pending = await operations.pendingOpenTab().catch(() => null);
    if (pending !== null && (await deps.activateTab(pending))) {
      return 'activated';
    }
    const created = await deps.createTab(SELECTOR_URL);
    if (created !== null) {
      await operations.add(created, 'open').catch(() => undefined);
    }
    return 'created';
  });
}
