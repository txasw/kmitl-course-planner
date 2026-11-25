// The request tripwire of a fill run (ADR-0078). It counts the resource entries the page
// starts through XMLHttpRequest while the run is active, without reading an entry's name,
// which carries the student id. The run expects at most one, the host's own eligibility
// read, after it enters a subject id, and none after any other step; any other count
// stops the run as a request of the page's own. It sees a request only after it started,
// so it backs up the tested build gate rather than replacing it, and it does not latch,
// because the host's token refresh can add an entry, and so can the period check that
// app.a1e43722 runs every 60 s, on a window focus, and on a visibility change. Telling
// that check apart by its address would mean reading the names, so a run it lands in
// stops, and the student's next press goes on. A browser without the observer gets no
// tripwire.

export interface Tripwire {
  /** The XMLHttpRequest entries seen since the tripwire started. */
  count: () => number;
  stop: () => void;
}

type ObserverClass = new (
  callback: (list: { getEntries: () => PerformanceEntry[] }) => void,
) => { observe: (options: { type: string }) => void; disconnect: () => void };

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
    for (const entry of list.getEntries()) {
      if (
        'initiatorType' in entry &&
        entry.initiatorType === 'xmlhttprequest'
      ) {
        seen += 1;
      }
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
