import { useSearchDeps } from './SearchDepsContext';
import { useSearchBoot } from './useSearchController';

// A zero render child that starts loading the last search when the app root mounts, so
// a reload's first open finds it loaded. The term seed waits for that open, so a host
// route captured then still wins.
export function SearchBoot() {
  useSearchBoot(useSearchDeps());
  return null;
}
