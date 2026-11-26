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
// query parameter equal to check-registration-datetime, compared as the entry is taken
// and then dropped. An entry name can carry the student id, so nothing of it is kept,
// logged, or sent; the tripwire keeps a count and nothing else. The host sends its
// writes as a POST whose function is in the body, so a write's address carries no
// function and is counted, as is every other request. A browser without the observer
// gets no tripwire.
//
// A run reads the count in the tasks right after the host's answer, and the browser does
// not promise that the observer's own callback task runs before them: in Chromium and
// Firefox both, at the end of a request the entry is already in the observer's buffer
// while its callback has not yet run. So each reading of the count first takes the
// buffered entries itself, and the eligibility read always lands in the window of the
// step that caused it.

import { REGIS_ORIGIN } from '@/lib/shell/hostTab';

export interface Tripwire {
  /** The XMLHttpRequest entries seen since the tripwire started, less period checks. */
  count: () => number;
  stop: () => void;
}

interface ObserverInstance {
  observe: (options: { type: string }) => void;
  disconnect: () => void;
  takeRecords?: () => PerformanceEntry[];
}

type ObserverClass = new (
  callback: (list: { getEntries: () => PerformanceEntry[] }) => void,
) => ObserverInstance;

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

const isRequest = (entry: PerformanceEntry) =>
  'initiatorType' in entry && entry.initiatorType === 'xmlhttprequest';

export function startTripwire(
  Observer: ObserverClass | undefined = pageObserver(),
): Tripwire {
  let seen = 0;
  if (Observer === undefined) return { count: () => 0, stop: () => undefined };
  // Every request is counted unless it reads as the period check, so an entry that cannot
  // be read counts its whole batch and the run stops, never the other way.
  const take = (entries: readonly PerformanceEntry[]) => {
    let counted = 0;
    try {
      for (const entry of entries) {
        if (!isRequest(entry) || isPeriodCheck(entry.name)) continue;
        counted += 1;
      }
    } catch {
      seen += entries.length;
      return;
    }
    seen += counted;
  };
  const observer = new Observer((list) => {
    take(list.getEntries());
  });
  observer.observe({ type: 'resource' });
  const flush = () => {
    if (observer.takeRecords !== undefined) take(observer.takeRecords());
  };
  return {
    count: () => {
      flush();
      return seen;
    },
    stop: () => {
      observer.disconnect();
    },
  };
}
