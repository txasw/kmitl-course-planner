// The request tripwire of a fill run (ADR-0078). It counts the resource entries the page
// starts through XMLHttpRequest while the run is active. The run expects at most one, the
// host's own eligibility read, after it enters a subject id, and none after any other
// step; any other count stops the run as a request of the page's own. It sees a request
// only after it started, so it backs up the tested build gate rather than replacing it,
// and it does not latch, because the host's token refresh can add an entry.
//
// One request is never counted: the host's own period check, which the polling builds
// send every 60 s, on a window focus, and on a visibility change (owner ruling of
// 2026-11-26). It is told apart by its address alone: the host API path and a function
// query parameter equal to check-registration-datetime, compared in the observer's
// callback and then dropped. An entry name can carry the student id, so nothing of it is
// kept, logged, or sent; the tripwire keeps a count and nothing else. The host sends its
// writes as a POST whose function is in the body, so a write's address carries no
// function and is counted, as is every other request. A browser without the observer
// gets no tripwire.

import { REGIS_ORIGIN } from '@/lib/shell/hostTab';

export interface Tripwire {
  /** The XMLHttpRequest entries seen since the tripwire started, less period checks. */
  count: () => number;
  stop: () => void;
}

type ObserverClass = new (
  callback: (list: { getEntries: () => PerformanceEntry[] }) => void,
) => { observe: (options: { type: string }) => void; disconnect: () => void };

/** The address the host's API client sends every request to, before its query. */
const HOST_API = `${REGIS_ORIGIN}/api/`;
/** The function of the host's period check, a read only GET (ADR-0078). */
export const PERIOD_CHECK_FUNCTION = 'check-registration-datetime';

/**
 * Whether a resource entry name is the host's period check: the host API path with one
 * function query parameter equal to the period check's, by exact comparison.
 */
export function isPeriodCheck(name: string): boolean {
  let url: URL;
  // A name that is no address is counted. URL.canParse is newer than some browsers
  // KCP runs on, and a throw here would leave the entry uncounted.
  try {
    url = new URL(name);
  } catch {
    return false;
  }
  if (url.origin + url.pathname !== HOST_API) return false;
  const functions = url.searchParams.getAll('function');
  return functions.length === 1 && functions[0] === PERIOD_CHECK_FUNCTION;
}

// The observer as the page exposes it, absent in a browser without it.
function pageObserver(): ObserverClass | undefined {
  return 'PerformanceObserver' in globalThis
    ? globalThis.PerformanceObserver
    : undefined;
}

export function startTripwire(
  Observer: ObserverClass | undefined = pageObserver(),
): Tripwire {
  let seen = 0;
  if (Observer === undefined) return { count: () => 0, stop: () => undefined };
  const observer = new Observer((list) => {
    // Every entry is counted before any name is looked at, so a name that cannot be
    // read leaves the count high and the run stops, never the other way.
    const requests = list
      .getEntries()
      .filter(
        (entry) =>
          'initiatorType' in entry && entry.initiatorType === 'xmlhttprequest',
      );
    seen += requests.length;
    for (const entry of requests) {
      if (isPeriodCheck(entry.name)) seen -= 1;
    }
  });
  observer.observe({ type: 'resource' });
  return {
    count: () => seen,
    stop: () => {
      observer.disconnect();
    },
  };
}
