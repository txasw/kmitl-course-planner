// The extension's service worker in an end to end context. The worker may already
// be running when the context is handed over, so the open workers are checked
// before waiting for one to start.

import type { BrowserContext, Worker } from '@playwright/test';

export async function extensionWorker(
  context: BrowserContext,
): Promise<Worker> {
  return (
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  );
}
