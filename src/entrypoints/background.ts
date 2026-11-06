import { IS_DEBUG } from '@/lib/env';
import {
  createBrowserStorageAdapter,
  createSessionStorageAdapter,
} from '@/lib/storage/browserAdapter';
import { createTabIntentStore } from '@/lib/storage/tabIntents';
import { handleActionClick, type ClickedTab } from '@/lib/shell/actionClick';
import { HOST_MATCH_PATTERNS } from '@/lib/shell/hostTab';
import { answerMountHandshake } from '@/lib/shell/mountHandshake';
import { answerWelcomeClaim } from '@/lib/shell/welcomeClaim';
import { createCacheStore } from '@/lib/api/cache';
import { createDefaultEnv, createGateway } from '@/lib/api/gateway';
import {
  currentTermEndpoint,
  curriculumEndpoint,
  departmentEndpoint,
  facultyEndpoint,
  subjectOwnerEndpoint,
} from '@/lib/api/endpoints';
import { createRouter, type HandlerMap } from '@/lib/messaging/router';
import { ok } from '@/lib/utils/result';
import { logger } from '@/lib/utils/logger';

// Brings a tab and its window to the front. Neither call needs the tabs permission.
// Only a failed tab update means the tab is gone; a window that cannot take focus
// still leaves the tab active, so it must not make the click open a second tab.
async function activateTab(tabId: number): Promise<boolean> {
  let windowId: number | undefined;
  try {
    windowId = (await browser.tabs.update(tabId, { active: true }))?.windowId;
  } catch {
    return false;
  }
  if (windowId !== undefined) {
    await browser.windows
      .update(windowId, { focused: true })
      .catch(() => undefined);
  }
  return true;
}

async function createTab(url: string): Promise<number | null> {
  const tab = await browser.tabs.create({ url });
  return tab.id ?? null;
}

// The background service worker is the single network and cache authority. It
// builds the gateway over the browser storage cache, exposes the typed handlers
// through the message router, and validates every inbound message. It also turns a
// toolbar icon click or the open shortcut into an open panel, and decides which host
// tab shows the welcome after install (ADR-0062). Debug builds additionally install
// the diagnostics interceptors and a console handle through a dynamic import that
// dead code eliminates from production.
export default defineBackground(() => {
  const cache = createCacheStore(createBrowserStorageAdapter());
  const gateway = createGateway({ cache, env: createDefaultEnv() });
  // One store for the whole worker, since its queue is what serializes the steps.
  const session = createSessionStorageAdapter();
  const intents = session === null ? null : createTabIntentStore(session);

  const onActionClick = (tab: ClickedTab) =>
    handleActionClick(tab, {
      requestHostAccess: import.meta.env.FIREFOX
        ? () =>
            browser.permissions.request({ origins: [...HOST_MATCH_PATTERNS] })
        : null,
      sendToTab: (tabId, message) => browser.tabs.sendMessage(tabId, message),
      activateTab,
      createTab,
      intents,
    });

  // Registered synchronously, so a click that wakes the worker reaches it.
  browser.action.onClicked.addListener((tab) => {
    onActionClick(tab).catch((error: unknown) => {
      logger.warn('toolbar action failed', error);
    });
  });

  const handlers: HandlerMap = {
    'ref/faculty': (message) =>
      gateway.reference(facultyEndpoint, message.refresh),
    'ref/department': (message) =>
      gateway.reference(departmentEndpoint, message.refresh),
    'ref/curriculum': (message) =>
      gateway.reference(curriculumEndpoint, message.refresh),
    'ref/subjectOwner': (message) =>
      gateway.reference(subjectOwnerEndpoint, message.refresh),
    'ref/currentTerm': (message) =>
      gateway.reference(currentTermEndpoint, message.refresh),
    'teachTable/query': (message) =>
      gateway.teachTable(message.query, message.refresh),
    'teachTable/cancel': (message) => {
      gateway.cancelTeachTable(message.query);
      return Promise.resolve(ok(undefined));
    },
    'shell/mounted': async (_message, context) =>
      ok(
        await answerMountHandshake(context, {
          intents,
          getCommands: () => browser.commands.getAll(),
        }),
      ),
    'onboarding/claimWelcome': async (_message, context) =>
      ok(await answerWelcomeClaim(context, { intents })),
  };

  const router = createRouter({ handlers, runtimeId: browser.runtime.id });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const response = router(message, sender);
    if (!response) {
      // A dropped message (foreign sender) is not handled here.
      return false;
    }
    void response.then(sendResponse);
    // Keep the channel open so the resolved Result reaches the caller.
    return true;
  });

  if (IS_DEBUG) {
    void import('@/lib/api/debug/register').then((module) => {
      module.installDebug({
        extensionVersion: browser.runtime.getManifest().version,
        runtimeId: browser.runtime.id,
        router,
        clearCache: () => cache.clear(),
        actionClick: onActionClick,
      });
      logger.debug('diagnostics interceptors installed');
    });
  }

  logger.debug('background gateway ready');
});
