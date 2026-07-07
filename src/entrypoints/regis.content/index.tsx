import './style.css';
import { createRoot, type Root } from 'react-dom/client';
import { createPrefsRepository } from '@/lib/storage/prefs';
import { createBrowserStorageAdapter } from '@/lib/storage/browserAdapter';
import { App } from './App';

// The content script runs once per document. Because the host is a hash routed
// single page application, later phases react to hashchange and popstate rather
// than page loads. The UI mounts inside a closed shadow root so host styles and
// extension styles never leak across the boundary.
export default defineContentScript({
  matches: ['https://regis.reg.kmitl.ac.th/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'kcp-planner-root',
      position: 'inline',
      anchor: 'body',
      mode: 'closed',
      isolateEvents: true,
      onMount: (container) => {
        const wrapper = document.createElement('div');
        wrapper.id = 'kcp-app';
        container.append(wrapper);
        const root = createRoot(wrapper);
        const prefs = createPrefsRepository(createBrowserStorageAdapter());
        root.render(<App prefs={prefs} />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
