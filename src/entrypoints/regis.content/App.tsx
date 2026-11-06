import type { PrefsRepository } from '@/lib/storage/prefs';
import { Launcher } from '@/features/shell/Launcher';
import { Overlay } from '@/features/shell/Overlay';
import { Toaster } from '@/features/shell/Toaster';
import { usePrefsPersistence } from '@/features/shell/usePrefsPersistence';
import {
  usePlanPersistence,
  type PlanPersistenceDeps,
} from '@/features/plans/usePlanPersistence';
import { useRevalidationTriggers } from '@/features/plans/useRevalidationTriggers';
import { useUpdatesAutoOpen } from '@/features/plans/useUpdatesAutoOpen';
import {
  SearchDepsProvider,
  useSearchDeps,
  type SearchDeps,
} from '@/features/search/SearchDepsContext';
import { DiagnosticsGate } from '@/features/diagnostics/DiagnosticsGate';
import {
  useOnboardingPersistence,
  type OnboardingPersistenceDeps,
} from '@/features/onboarding/useOnboardingPersistence';
import {
  useWorkerHandshake,
  type WorkerHandshakeDeps,
} from '@/features/onboarding/useWorkerHandshake';
import {
  useWelcomeClaim,
  type WelcomeClaimDeps,
} from '@/features/onboarding/useWelcomeClaim';

interface AppProps {
  prefs: PrefsRepository;
  plans: PlanPersistenceDeps;
  search: SearchDeps;
  onboarding: OnboardingPersistenceDeps;
  handshake: WorkerHandshakeDeps;
  welcome: WelcomeClaimDeps;
}

// Root component for the content script UI. It renders the launcher and the
// overlay, hydrates and persists the language, the plans and the onboarding
// record through the injected repositories, listens for the worker and sends it
// the mount handshake, decides whether this document claims the welcome, and provides the search dependencies so the deep form
// components stay free of the browser binding. The storage and messaging bindings
// stay at the entrypoint.
export function App({
  prefs,
  plans,
  search,
  onboarding,
  handshake,
  welcome,
}: AppProps) {
  usePrefsPersistence(prefs);
  usePlanPersistence(plans);
  useOnboardingPersistence(onboarding);
  useWorkerHandshake(handshake);
  useWelcomeClaim(welcome);
  return (
    <SearchDepsProvider value={search}>
      <RevalidationTriggers />
      <Launcher />
      <Overlay />
      <DiagnosticsGate />
      <Toaster />
    </SearchDepsProvider>
  );
}

// A zero render child so the revalidation triggers can read the injected send from
// the search deps context rather than threading it through props. The updates dialog's
// automatic opening rides along, since it acts on what those triggers find.
function RevalidationTriggers() {
  const { send } = useSearchDeps();
  useRevalidationTriggers(send);
  useUpdatesAutoOpen();
  return null;
}
