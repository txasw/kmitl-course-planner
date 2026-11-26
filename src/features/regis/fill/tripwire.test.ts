import { describe, expect, it } from 'vitest';
import { isPeriodCheck, startTripwire } from './tripwire';

type Callback = (list: { getEntries: () => PerformanceEntry[] }) => void;

function fakeObserver() {
  const state: { callback: Callback | null; type: string; off: boolean } = {
    callback: null,
    type: '',
    off: false,
  };
  class Fake {
    constructor(callback: Callback) {
      state.callback = callback;
    }
    observe(options: { type: string }) {
      state.type = options.type;
    }
    disconnect() {
      state.off = true;
    }
  }
  return { Fake, state };
}

const API = 'https://regis.reg.kmitl.ac.th/api/';
// The period check as the host's API client sends it, its params after the function.
const PERIOD = `${API}?function=check-registration-datetime&level_id=1&year=2569&semester=2`;

// An address of the host API with this function. The host's real registration write
// names stay out of src by the write name scan, so a name shaped like one is made up.
function apiCall(fn: string): string {
  const url = new URL(API);
  url.searchParams.set('function', fn);
  return url.href;
}

function entry(initiatorType: string, name: string): PerformanceEntry {
  // Test only: a plain object standing in for a resource entry, which jsdom lacks.
  return { initiatorType, name } as unknown as PerformanceEntry;
}

function unreadable(): PerformanceEntry {
  // Test only: a resource entry whose name getter fails.
  return Object.defineProperties(
    {},
    {
      initiatorType: { value: 'xmlhttprequest' },
      name: {
        get: () => {
          throw new Error('no name');
        },
      },
    },
  ) as PerformanceEntry;
}

function observe(...batches: PerformanceEntry[][]) {
  const { Fake, state } = fakeObserver();
  const tripwire = startTripwire(Fake);
  for (const batch of batches) state.callback?.({ getEntries: () => batch });
  return { tripwire, state };
}

describe('startTripwire', () => {
  it('counts the page XMLHttpRequest entries', () => {
    const { tripwire, state } = observe(
      [
        entry('xmlhttprequest', `${API}?function=get-student-data`),
        entry('img', `${API}logo.png`),
        entry('fetch', `${API}?function=get-config`),
      ],
      [entry('xmlhttprequest', `${API}?function=get-pattern-subject`)],
    );
    expect(state.type).toBe('resource');
    expect(tripwire.count()).toBe(2);
    tripwire.stop();
    expect(state.off).toBe(true);
  });

  it('does not count the host period check mid run', () => {
    const { tripwire } = observe(
      [entry('xmlhttprequest', `${API}?function=get-pattern-subject`)],
      [entry('xmlhttprequest', PERIOD)],
      [entry('xmlhttprequest', PERIOD), entry('xmlhttprequest', PERIOD)],
    );
    expect(tripwire.count()).toBe(1);
  });

  it.each([
    ['another function', `${API}?function=get-student-data&student_id=1`],
    ['a near miss', `${API}?function=check-registration-datetime-x`],
    ['a prefix', `${API}?function=check-registration`],
    ['another case', `${API}?function=Check-Registration-Datetime`],
    ['a name shaped like a registration write', apiCall('regis-sample-write')],
    ['a second function', `${PERIOD}&function=get-config`],
    ['no function, as a POST sends it', API],
    ['an empty function', `${API}?function=`],
    [
      'another path',
      'https://regis.reg.kmitl.ac.th/apis/?function=check-registration-datetime',
    ],
    ['a path below the API', `${API}x?function=check-registration-datetime`],
    [
      'another origin',
      'https://api.reg.kmitl.ac.th/api/?function=check-registration-datetime',
    ],
    [
      'plain http',
      'http://regis.reg.kmitl.ac.th/api/?function=check-registration-datetime',
    ],
    ['a relative name', '/api/?function=check-registration-datetime'],
  ])('still counts %s', (_name, name) => {
    expect(isPeriodCheck(name)).toBe(false);
    const { tripwire } = observe([entry('xmlhttprequest', name)]);
    expect(tripwire.count()).toBe(1);
  });

  it('counts an entry whose name cannot be read, and the rest of its batch', () => {
    const { Fake, state } = fakeObserver();
    const tripwire = startTripwire(Fake);
    expect(() => {
      state.callback?.({
        getEntries: () => [
          unreadable(),
          entry('xmlhttprequest', PERIOD),
          entry('xmlhttprequest', `${API}?function=get-config`),
        ],
      });
    }).not.toThrow();
    expect(tripwire.count()).toBe(3);
    // And the page no longer reads as quiet, whatever the clock says.
    expect(tripwire.quiet(0)).toBe(false);
  });

  it('takes the entries its callback has not had yet when the count is read', () => {
    let buffered: PerformanceEntry[] = [];
    class Buffering {
      constructor(readonly callback: Callback) {}
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
      takeRecords() {
        const taken = buffered;
        buffered = [];
        return taken;
      }
    }
    const tripwire = startTripwire(Buffering, {
      entries: () => [],
      clock: () => 0,
    });
    // A request ended, and the page's handler of its end reads the count before the
    // observer's callback task runs.
    buffered = [entry('xmlhttprequest', `${API}?function=get-config`)];
    expect(tripwire.count()).toBe(1);
    // Taken once, out of the buffer the callback reads, so the count stays.
    expect(buffered).toEqual([]);
    expect(tripwire.count()).toBe(1);
    buffered = [entry('xmlhttprequest', PERIOD)];
    expect(tripwire.count()).toBe(1);
  });

  it('knows the period check by its exact address', () => {
    expect(isPeriodCheck(PERIOD)).toBe(true);
    expect(isPeriodCheck(`${API}?function=check-registration-datetime`)).toBe(
      true,
    );
  });

  it('counts nothing where the browser has no observer', () => {
    expect(startTripwire(undefined).count()).toBe(0);
    expect(startTripwire(undefined).quiet(1500)).toBe(true);
  });

  describe('quiet', () => {
    function ended(name: string, at: number): PerformanceEntry {
      // Test only: a plain object standing in for a resource entry, which jsdom lacks.
      return {
        initiatorType: 'xmlhttprequest',
        name,
        responseEnd: at,
      } as unknown as PerformanceEntry;
    }

    function tripwireAt(
      clock: { now: number },
      before: readonly PerformanceEntry[],
    ) {
      const { Fake, state } = fakeObserver();
      const tripwire = startTripwire(Fake, {
        entries: () => before,
        clock: () => clock.now,
      });
      return { tripwire, state };
    }

    it('reads a page with no request before the run as quiet', () => {
      const { tripwire } = tripwireAt({ now: 10_000 }, []);
      expect(tripwire.quiet(1500)).toBe(true);
    });

    it('reads a request that ended in the moment before as busy, until it passes', () => {
      const clock = { now: 10_000 };
      const { tripwire } = tripwireAt(clock, [
        ended(`${API}?function=get-student-credit`, 9_200),
        ended(`${API}?function=get-pattern-subject`, 8_000),
      ]);
      expect(tripwire.quiet(1500)).toBe(false);
      clock.now = 10_700;
      expect(tripwire.quiet(1500)).toBe(true);
    });

    it.each([
      ['a period check', PERIOD],
      ['an image', `${API}logo.png`],
    ])('leaves out %s', (_name, name) => {
      const before =
        name === PERIOD
          ? [ended(name, 9_900)]
          : [
              {
                initiatorType: 'img',
                name,
                responseEnd: 9_900,
              } as unknown as PerformanceEntry,
            ];
      const { tripwire } = tripwireAt({ now: 10_000 }, before);
      expect(tripwire.quiet(1500)).toBe(true);
    });

    it('reads a request that ends after the start as busy', () => {
      const clock = { now: 10_000 };
      const { tripwire, state } = tripwireAt(clock, []);
      state.callback?.({
        getEntries: () => [ended(`${API}?function=get-config`, 10_050)],
      });
      clock.now = 10_100;
      expect(tripwire.quiet(1500)).toBe(false);
    });

    it.each([
      [
        'a full timeline, which takes no more entries',
        Array.from({ length: 250 }, () => entry('img', `${API}logo.png`)),
      ],
      [
        'an entry that does not say when it ended',
        [entry('xmlhttprequest', API)],
      ],
      ['an entry that cannot be read', [unreadable()]],
    ])('reads %s as busy', (_name, before) => {
      const { tripwire } = tripwireAt({ now: 10_000 }, before);
      expect(tripwire.quiet(1500)).toBe(false);
    });
  });
});
