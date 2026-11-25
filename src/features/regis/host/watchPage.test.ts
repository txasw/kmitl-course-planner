import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mountReplica,
  type Replica,
  type ReplicaPatch,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import { readHostPage, type PageReading } from './hostDom';
import { SETTLE_MS, WAITING_GAP_MS, watchHostPage } from './watchPage';

// The observer's watch against the replica, on fake timers. The bound: while the page
// shows no panel, the watch reads only after an element is added or removed under the app
// root, and never twice within a second; once the panel shows, the countdown of the
// app.a1e43722 route above it reads nothing. The host unmounting the panel and mounting it
// again, as that build's period check can make it do, is read without a navigation.

const PLANNED = new Set(['01476107']);

let replica: Replica | null = null;
let end: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  end?.();
  end = null;
  replica?.destroy();
  replica = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

function mountRoute(patch: ReplicaPatch = {}): Replica {
  replica = mountReplica(document, patch, { route: 'a1e43722', poll: 0 });
  return replica;
}

/** Watch the page, keeping every reading in order. */
function watch(): PageReading['reading'][] {
  const readings: PageReading['reading'][] = [];
  end = watchHostPage(document, () => {
    const { reading } = readHostPage(document, PLANNED);
    readings.push(reading);
    return reading;
  });
  return readings;
}

describe('watchHostPage', () => {
  it('reads on arrival and once after a change settles', async () => {
    replica = mountReplica(document);
    const readings = watch();
    expect(readings).toEqual(['ok']);
    replica.set({ list: [{ subjectId: '01476107', section: '1', kind: 'ท' }] });
    await vi.advanceTimersByTimeAsync(SETTLE_MS - 1);
    expect(readings).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(readings).toEqual(['ok', 'ok']);
  });

  it('reads nothing while the countdown ticks before the period opens', async () => {
    mountRoute({ period: 'before' });
    const readings = watch();
    const digits = () =>
      document.querySelector('.period-digits')?.textContent ?? '';
    const before = digits();
    await vi.advanceTimersByTimeAsync(30_000);
    // The countdown ran for thirty seconds and the page was read on arrival alone.
    expect(digits()).not.toBe(before);
    expect(readings).toEqual(['absent']);
  });

  it('reads at most once a second while the page shows no panel', async () => {
    mountRoute({ period: 'before' });
    const readings = watch();
    const main = document.querySelector('.v-main__wrap');
    // A page that adds an element under the app root every 200 ms for ten seconds, each
    // change outlasting the settle, so the settle alone would read fifty times.
    const noise = setInterval(() => {
      main?.append(document.createElement('span'));
    }, 200);
    await vi.advanceTimersByTimeAsync(10_000);
    clearInterval(noise);
    await vi.advanceTimersByTimeAsync(WAITING_GAP_MS);
    expect(readings.length).toBeGreaterThan(5);
    expect(readings.length).toBeLessThanOrEqual(1 + 10_000 / WAITING_GAP_MS);
    expect(readings.at(-1)).toBe('absent');
  });

  it('keeps the same bound when a page with no panel does not read as absent', async () => {
    // The stepper and the add card show, but not the header row that holds the term, so
    // there is no panel and the reading is not absent.
    replica = mountReplica(document);
    document.querySelector('.row.grey')?.remove();
    const readings = watch();
    expect(readings).toHaveLength(1);
    expect(readings[0]).not.toBe('absent');
    const main = document.querySelector('.v-main__wrap');
    const text = document.createTextNode('0');
    main?.append(text);
    const settled = readings.length;
    // Text rewritten in place, as a countdown does, reads nothing.
    let tick = 0;
    const digits = setInterval(() => {
      tick += 1;
      text.data = String(tick);
    }, 1000);
    await vi.advanceTimersByTimeAsync(10_000);
    clearInterval(digits);
    expect(readings.length).toBeLessThanOrEqual(settled + 1);
    // Elements added every 200 ms read at most once a second.
    const before = readings.length;
    const noise = setInterval(() => {
      main?.append(document.createElement('span'));
    }, 200);
    await vi.advanceTimersByTimeAsync(10_000);
    clearInterval(noise);
    expect(readings.length - before).toBeGreaterThan(5);
    expect(readings.length - before).toBeLessThanOrEqual(
      10_000 / WAITING_GAP_MS,
    );
  });

  it('reads nothing while the countdown ticks beside a shown panel', async () => {
    mountRoute();
    const readings = watch();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(readings).toEqual(['ok']);
  });

  it('reads the panel leaving and coming back with no navigation', async () => {
    const page = mountRoute({
      list: [{ subjectId: '01476107', section: '1', kind: 'ท' }],
    });
    page.configure({ delay: 100 });
    const readings = watch();
    page.set({ period: 'closed' });
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
    expect(readings).toEqual(['ok', 'absent']);
    // The panel mounts again within the second after the last reading, which waits for
    // the gap, then reads the panel the host mounted afresh.
    page.set({ period: 'open' });
    await vi.advanceTimersByTimeAsync(WAITING_GAP_MS);
    expect(readings.at(-1)).toBe('ok');
    const fresh = readHostPage(document, PLANNED);
    expect(fresh.reading === 'ok' ? fresh.observation.list : null).toEqual([]);
    // Once the panel shows again the countdown reads nothing.
    const count = readings.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(readings.length).toBeLessThanOrEqual(count + 1);
  });

  it('reads the panel leaving when only the element that holds it changes', async () => {
    // As the host unmounts the panel by its v-if when no dialog was ever opened, so no
    // child of the app root changes.
    mountRoute();
    const readings = watch();
    document.querySelector('.row.grey')?.parentElement?.remove();
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
    expect(readings).toEqual(['ok', 'absent']);
  });

  it('ends the watch once the observer turns off', async () => {
    replica = mountReplica(document);
    let calls = 0;
    end = watchHostPage(document, () => {
      calls += 1;
      return 'off';
    });
    replica.set({ list: [{ subjectId: '01476107', section: '1', kind: 'ท' }] });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(calls).toBe(1);
  });
});
