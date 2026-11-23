import { describe, expect, it } from 'vitest';
import { startTripwire } from './tripwire';

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

function entry(initiatorType: string): PerformanceEntry {
  // Test only: a resource entry whose name getter fails, so a read of it would throw.
  return Object.defineProperties(
    {},
    {
      initiatorType: { value: initiatorType },
      name: {
        get: () => {
          throw new Error('the tripwire read an entry name');
        },
      },
    },
  ) as PerformanceEntry;
}

describe('startTripwire', () => {
  it('counts the page XMLHttpRequest entries without reading their names', () => {
    const { Fake, state } = fakeObserver();
    const tripwire = startTripwire(Fake);
    expect(state.type).toBe('resource');
    state.callback?.({
      getEntries: () => [entry('xmlhttprequest'), entry('img'), entry('fetch')],
    });
    state.callback?.({ getEntries: () => [entry('xmlhttprequest')] });
    expect(tripwire.count()).toBe(2);
    tripwire.stop();
    expect(state.off).toBe(true);
  });

  it('counts nothing where the browser has no observer', () => {
    expect(startTripwire(undefined).count()).toBe(0);
  });
});
