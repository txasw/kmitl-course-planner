// Hold the poster capture and the clipboard text write for a while, so a spec sees the busy
// state a slow phone would show. The hold is installed in the extension's own isolated world,
// where the content script reads document.fonts.ready before a capture and writes the
// clipboard, through the DevTools protocol, since a page script reaches only the main world.
// Playwright's own utility world is left alone, as it reads the fonts before a screenshot.

import type { Page } from '@playwright/test';

interface ContextDescription {
  id: number;
  name: string;
}

/** The start of the isolated world name the extension's content script runs in. */
const EXTENSION_WORLD = 'KCP: ';

export async function holdWork(page: Page, ms: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const contexts: ContextDescription[] = [];
  cdp.on('Runtime.executionContextCreated', (event) => {
    contexts.push(event.context);
  });
  // Enabling reports every existing context before it answers.
  await cdp.send('Runtime.enable');
  const worlds = contexts.filter((context) =>
    context.name.startsWith(EXTENSION_WORLD),
  );
  if (worlds.length === 0) throw new Error('No extension world on the page');
  for (const world of worlds) {
    const result = await cdp.send('Runtime.evaluate', {
      contextId: world.id,
      expression: `(() => {
        const wait = () => new Promise((resolve) => setTimeout(resolve, ${String(ms)}));
        const fonts = document.fonts;
        Object.defineProperty(fonts, 'ready', {
          configurable: true,
          get: () => wait().then(() => fonts),
        });
        const clipboard = navigator.clipboard;
        const writeText = clipboard.writeText.bind(clipboard);
        clipboard.writeText = (text) => wait().then(() => writeText(text));
      })()`,
    });
    if (result.exceptionDetails !== undefined) {
      throw new Error(
        `Could not hold the work: ${result.exceptionDetails.text}`,
      );
    }
  }
  await cdp.detach();
}
