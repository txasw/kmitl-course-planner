import '@/lib/zodConfig';
import './style.css';
import { createRoot, type Root } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { IS_DEBUG } from '@/lib/env';
import { REGIS_MATCH_PATTERN } from '@/lib/shell/hostTab';
import { sendTyped } from '@/lib/messaging/sendTyped';
import { quietAwareSend } from '@/lib/regis/quietMode';
import { isQuietRoute } from '@/features/shell/quietRoute';
import { createPrefsRepository } from '@/lib/storage/prefs';
import { createSearchStateRepository } from '@/lib/storage/lastSearch';
import { createBrowserStorageAdapter } from '@/lib/storage/browserAdapter';
import { createPlanRepository } from '@/lib/storage/repo';
import { createInstallRepository } from '@/lib/storage/install';
import { createOnboardingRepository } from '@/lib/storage/onboarding';
import {
  createChecklistRepository,
  createFillSettingsRepository,
  createRegKitRepository,
} from '@/lib/storage/regis';
import { readExtensionVersion } from '@/lib/shell/extensionVersion';
import { App } from './App';

// The content script runs once per document on the registration site. It mounts
// the React app inside a shadow root so host styles and extension styles never
// leak across the boundary, and it is the one place that binds the app to the
// browser: it builds the storage repositories over storage.local and injects the
// typed worker client, the runtime id, the message listener, and the manifest
// version, so the components below never call the extension APIs directly. The host
// is a hash routed single page application that never reloads, so route awareness
// lives in the app's hashchange and popstate listeners rather than here. Production
// uses a closed root for host isolation; debug builds use an open root so in
// browser accessibility scans and browser driven tests can reach the tree without a
// source edit (ADR-0019).
export default defineContentScript({
  matches: [REGIS_MATCH_PATTERN],
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
          // Every search, check, and reference read starts here, so a request started on
          // a registration page never retries (ADR-0075).
          send: quietAwareSend(sendTyped, isQuietRoute),
          repo: createSearchStateRepository(adapter),
        };
        // One onboarding repository for the document, so the welcome claim's write
        // queues behind the first panel open write rather than racing it.
        const onboardingRecord = createOnboardingRepository(adapter);
        const onboarding = {
          install: createInstallRepository(adapter),
          record: onboardingRecord,
        };
        const handshake = {
          runtimeId: browser.runtime.id,
          onMessage: browser.runtime.onMessage,
          send: sendTyped,
        };
        const welcome = { record: onboardingRecord, send: sendTyped };
        const regis = {
          kits: createRegKitRepository(adapter),
          checklists: createChecklistRepository(adapter),
          fill: createFillSettingsRepository(adapter),
        };
        root.render(
          <App
            prefs={prefs}
            plans={plans}
            search={search}
            onboarding={onboarding}
            handshake={handshake}
            welcome={welcome}
            regis={regis}
            version={readExtensionVersion(() => browser.runtime.getManifest())}
          />,
        );
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
