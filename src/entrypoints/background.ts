import '@/lib/zodConfig';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  createBrowserStorageAdapter,
  createSessionStorageAdapter,
} from '@/lib/storage/browserAdapter';
import { createInstallRepository } from '@/lib/storage/install';
import { createTabIntentStore } from '@/lib/storage/tabIntents';
import { handleActionClick, type ClickedTab } from '@/lib/shell/actionClick';
import { HOST_MATCH_PATTERNS } from '@/lib/shell/hostTab';
import { handleInstalled } from '@/lib/shell/install';
import { answerMountHandshake } from '@/lib/shell/mountHandshake';
import { answerWelcomeClaim } from '@/lib/shell/welcomeClaim';
import { createCacheStore } from '@/lib/api/cache';
import { createHostCheck } from '@/lib/api/hostCheck';
import type { RecordedBuild } from '@/lib/regis/fingerprint/fingerprint';
import { RECORDED_BUILDS } from '@/lib/regis/fingerprint/recorded';
import { createHostCheckRepository } from '@/lib/storage/hostChecks';
import { createDefaultEnv, createGateway } from '@/lib/api/gateway';
import {
  currentTermEndpoint,
  curriculumEndpoint,
  departmentEndpoint,
  facultyEndpoint,
  subjectOwnerEndpoint,
} from '@/lib/api/endpoints';
import {
  requestMessageSchema,
  type RequestMessage,
  type ResponseMap,
} from '@/lib/messaging/extensionProtocol';
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

// Whether both host origins are granted. The permissions API answers without the
// permissions permission, and the answer reflects a grant the student turned off.
function hasHostAccess(): Promise<boolean> {
  return browser.permissions.contains({ origins: [...HOST_MATCH_PATTERNS] });
}

// The background service worker is the single network and cache authority. It
// builds the gateway over the browser storage cache, exposes the typed handlers
// through the message router, and validates every inbound message. It also turns a
// toolbar icon click or the open shortcut into an open panel, opens the search page
// once on first install, and decides which host tab shows the welcome (ADR-0062).
// Debug builds additionally install the diagnostics interceptors and a console
// handle through a dynamic import that dead code eliminates from production.
export default defineBackground(() => {
  const cache = createCacheStore(createBrowserStorageAdapter());
  const env = createDefaultEnv();
  const gateway = createGateway({ cache, env });
  // The tested builds the host check compares a new build with; a debug build adds the
  // replica bundle's, so the end to end specs can serve it under an untested name.
  const recorded: RecordedBuild[] = [...RECORDED_BUILDS];
  const hostCheck = createHostCheck({
    env,
    repo: createHostCheckRepository(createBrowserStorageAdapter()),
    recorded: () => recorded,
  });
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

  // Registered synchronously, so the install event that starts the worker reaches it.
  browser.runtime.onInstalled.addListener((details) => {
    handleInstalled(details, {
      install: createInstallRepository(createBrowserStorageAdapter()),
      version: browser.runtime.getManifest().version,
      hasHostAccess,
      createTab,
      intents,
    }).catch((error: unknown) => {
      logger.warn('install handling failed', error);
    });
  });

  const handlers: HandlerMap<RequestMessage, ResponseMap> = {
    'ref/faculty': (message) => gateway.reference(facultyEndpoint, message),
    'ref/department': (message) =>
      gateway.reference(departmentEndpoint, message),
    'ref/curriculum': (message) =>
      gateway.reference(curriculumEndpoint, message),
    'ref/subjectOwner': (message) =>
      gateway.reference(subjectOwnerEndpoint, message),
    'ref/currentTerm': (message) =>
      gateway.reference(currentTermEndpoint, message),
    'teachTable/query': (message) => gateway.teachTable(message.query, message),
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
    'regis/hostBuild': async (message) =>
      ok(await hostCheck.check({ app: message.app, vendors: message.vendors })),
  };

  const router = createRouter({
    schema: requestMessageSchema,
    handlers,
    runtimeId: browser.runtime.id,
  });

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

  // Reads the define, not IS_DEBUG, so the debug import leaves the module graph
  // before it is scanned (see kcp-globals.d.ts).
  if (__KCP_DEBUG__) {
    void import('@/lib/api/debug/register').then((module) => {
      module.installDebug({
        extensionVersion: browser.runtime.getManifest().version,
        runtimeId: browser.runtime.id,
        router,
        clearCache: () => cache.clear(),
        actionClick: onActionClick,
        addRecorded: (build) => {
          recorded.push(build);
        },
      });
      logger.debug('diagnostics interceptors installed');
    });
  }

  logger.debug('background gateway ready');
});
