import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { useRevalidationTriggers } from './useRevalidationTriggers';
import { useUpdatesAutoOpen } from './useUpdatesAutoOpen';

// A zero render child so the revalidation triggers can read the injected send from the
// search deps context rather than threading it through props. The updates dialog's
// automatic opening rides along, since it acts on what those triggers find.
export function RevalidationTriggers() {
  const { send } = useSearchDeps();
  useRevalidationTriggers(send);
  useUpdatesAutoOpen();
  return null;
}
