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

interface AppProps {
  prefs: PrefsRepository;
  plans: PlanPersistenceDeps;
  search: SearchDeps;
  onboarding: OnboardingPersistenceDeps;
}

// Root component for the content script UI. It renders the launcher and the
// overlay, hydrates and persists the language, the plans and the onboarding
// record through the injected repositories, and provides the search dependencies
// so the deep form components stay free of the browser binding. The storage and
// messaging bindings stay at the entrypoint.
export function App({ prefs, plans, search, onboarding }: AppProps) {
  usePrefsPersistence(prefs);
  usePlanPersistence(plans);
  useOnboardingPersistence(onboarding);
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
// the search deps context rather than threading it through props.
function RevalidationTriggers() {
  const { send } = useSearchDeps();
  useRevalidationTriggers(send);
  return null;
}
