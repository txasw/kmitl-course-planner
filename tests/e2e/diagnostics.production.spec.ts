import { test, expect, gotoSelector } from './support/fixtures';

// The production build installs no diagnostics: the debug graph, including the
// service worker console handle, dead code eliminates. The overlay also mounts in
// a closed shadow root, so there is nothing to pierce; the service worker check is
// the deterministic runtime proof that production answers no debug surface.
test('installs no diagnostics handle in production', async ({
  context,
  serviceWorker,
}) => {
  await gotoSelector(context);
  const hasHandle = await serviceWorker.evaluate(() => '__kcp' in globalThis);
  expect(hasHandle).toBe(false);
});
