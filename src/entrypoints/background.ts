import { IS_DEBUG } from '@/lib/env';
import { createBrowserStorageAdapter } from '@/lib/storage/browserAdapter';
import { createCacheStore } from '@/lib/api/cache';
import { createDefaultEnv, createGateway } from '@/lib/api/gateway';
import {
  curriculumEndpoint,
  departmentEndpoint,
  facultyEndpoint,
  subjectOwnerEndpoint,
} from '@/lib/api/endpoints';
import { createRouter, type HandlerMap } from '@/lib/messaging/router';
import { logger } from '@/lib/utils/logger';

// The background service worker is the single network and cache authority. It
// builds the gateway over the browser storage cache, exposes the typed handlers
// through the message router, and validates every inbound message. Debug builds
// additionally install the diagnostics interceptors and a console handle through
// a dynamic import that dead code eliminates from production.
export default defineBackground(() => {
  const cache = createCacheStore(createBrowserStorageAdapter());
  const gateway = createGateway({ cache, env: createDefaultEnv() });

  const handlers: HandlerMap = {
    'ref/faculty': (message) =>
      gateway.reference(facultyEndpoint, message.refresh),
    'ref/department': (message) =>
      gateway.reference(departmentEndpoint, message.refresh),
    'ref/curriculum': (message) =>
      gateway.reference(curriculumEndpoint, message.refresh),
    'ref/subjectOwner': (message) =>
      gateway.reference(subjectOwnerEndpoint, message.refresh),
    'teachTable/query': (message) =>
      gateway.teachTable(message.query, message.refresh),
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
      });
      logger.debug('diagnostics interceptors installed');
    });
  }

  logger.debug('background gateway ready');
});
