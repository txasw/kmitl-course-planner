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
import { useSearchBoot } from '@/features/search/useSearchController';
import { DiagnosticsGate } from '@/features/diagnostics/DiagnosticsGate';
import {
  useOnboardingPersistence,
  type OnboardingPersistenceDeps,
} from '@/features/onboarding/useOnboardingPersistence';
import {
  useWorkerHandshake,
  type WorkerHandshakeDeps,
} from '@/features/onboarding/useWorkerHandshake';
import { WelcomeLayer } from '@/features/onboarding/WelcomeLayer';
import { EntryToast } from '@/features/onboarding/EntryToast';
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

// Root component for the content script UI. It renders the launcher, the entry toast
// beside it, the overlay and, while it is open, the welcome above everything else,
// since the shadow root stacks its host layer nodes by mount order. The entry toast
// follows the launcher, so Tab from the launcher reaches it. It hydrates and persists
// the language, the plans and the onboarding record through the injected
// repositories, listens for the worker and sends it the mount handshake, decides
// whether this document claims the welcome, and provides the search dependencies so
// the deep form components stay free of the browser binding. The storage and
// messaging bindings stay at the entrypoint.
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
      <SearchBoot />
      <RevalidationTriggers />
      <Launcher />
      <EntryToast record={onboarding.record} />
      <Overlay />
      <DiagnosticsGate />
      <Toaster />
      <WelcomeLayer />
    </SearchDepsProvider>
  );
}

// A zero render child that starts loading the last search when the content script
// mounts, so a reload's first open finds it loaded. The term seed waits for that open,
// so a host route captured then still wins.
function SearchBoot() {
  useSearchBoot(useSearchDeps());
  return null;
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
