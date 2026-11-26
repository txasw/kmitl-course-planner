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
    }).toThrow('no name');
    expect(tripwire.count()).toBe(3);
  });

  it('knows the period check by its exact address', () => {
    expect(isPeriodCheck(PERIOD)).toBe(true);
    expect(isPeriodCheck(`${API}?function=check-registration-datetime`)).toBe(
      true,
    );
  });

  it('counts nothing where the browser has no observer', () => {
    expect(startTripwire(undefined).count()).toBe(0);
  });
});
