import './style.css';
import { createRoot, type Root } from 'react-dom/client';
import { IS_DEBUG } from '@/lib/env';
import { sendTyped } from '@/lib/messaging/sendTyped';
import { createPrefsRepository } from '@/lib/storage/prefs';
import { createSearchStateRepository } from '@/lib/storage/lastSearch';
import { createBrowserStorageAdapter } from '@/lib/storage/browserAdapter';
import { createPlanRepository } from '@/lib/storage/repo';
import { App } from './App';

// The content script runs once per document. Because the host is a hash routed
// single page application, later phases react to hashchange and popstate rather
// than page loads. The UI mounts inside a shadow root so host styles and
// extension styles never leak across the boundary. Production uses a closed root
// for host isolation; debug builds use an open root so in browser accessibility
// scans and browser driven tests can reach the tree without a source edit.
export default defineContentScript({
  matches: ['https://regis.reg.kmitl.ac.th/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'kcp-planner-root',
      position: 'inline',
      anchor: 'body',
      mode: IS_DEBUG ? 'open' : 'closed',
      isolateEvents: true,
      onMount: (container) => {
        const wrapper = document.createElement('div');
        wrapper.id = 'kcp-app';
        container.append(wrapper);
        const root = createRoot(wrapper);
        const adapter = createBrowserStorageAdapter();
        const prefs = createPrefsRepository(adapter);
        const plans = { repo: createPlanRepository(adapter), adapter };
        const search = {
          send: sendTyped,
          repo: createSearchStateRepository(adapter),
        };
        root.render(<App prefs={prefs} plans={plans} search={search} />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
