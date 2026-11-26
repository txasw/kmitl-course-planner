import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchPage } from './pageWatch';

// The page watch a fill run waits on (ADR-0078, the timing amendment): a change of the
// page ends a wait at the next task, after the host's microtasks, and a timer ends it at
// the latest.

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const fakeTask = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe('watchPage', () => {
  it('ends a wait at the first task after the page changes', async () => {
    vi.useFakeTimers();
    const watch = watchPage(document, fakeTask);
    let woke = false;
    void watch.change(1000).then(() => {
      woke = true;
    });
    document.body.append(document.createElement('div'));
    await vi.advanceTimersByTimeAsync(0);
    expect(woke).toBe(true);
    watch.stop();
  });

  it('reads the page only after the microtasks the change queued', async () => {
    const watch = watchPage(document);
    const seen: string[] = [];
    const waited = watch.change(1000).then(() => {
      seen.push(document.body.textContent);
    });
    // A render, then a chained microtask that completes the answer, as Vue does.
    document.body.textContent = 'half';
    void Promise.resolve().then(() => {
      document.body.textContent = 'whole';
    });
    await waited;
    expect(seen).toEqual(['whole']);
    watch.stop();
  });

  it('ends a wait at its time when the page stays still', async () => {
    vi.useFakeTimers();
    const watch = watchPage(document, fakeTask);
    let woke = false;
    void watch.change(100).then(() => {
      woke = true;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(woke).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(woke).toBe(true);
    watch.stop();
  });

  it('wakes every wait of one change once', async () => {
    vi.useFakeTimers();
    const tasks = vi.fn(fakeTask);
    const watch = watchPage(document, tasks);
    const woke: number[] = [];
    void watch.change(1000).then(() => woke.push(1));
    void watch.change(1000).then(() => woke.push(2));
    document.body.append(document.createElement('div'));
    document.body.append(document.createElement('div'));
    await vi.advanceTimersByTimeAsync(0);
    expect(woke).toEqual([1, 2]);
    expect(tasks).toHaveBeenCalledTimes(1);
    watch.stop();
  });

  it('does not schedule a task for a change no wait is waiting on', async () => {
    vi.useFakeTimers();
    const tasks = vi.fn(fakeTask);
    const watch = watchPage(document, tasks);
    document.body.append(document.createElement('div'));
    await vi.advanceTimersByTimeAsync(0);
    expect(tasks).not.toHaveBeenCalled();
    watch.stop();
  });

  it('ends every wait when it stops, and sees no change after', async () => {
    vi.useFakeTimers();
    const tasks = vi.fn(fakeTask);
    const watch = watchPage(document, tasks);
    let woke = false;
    void watch.change(1000).then(() => {
      woke = true;
    });
    watch.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(woke).toBe(true);
    void watch.change(1000);
    document.body.append(document.createElement('div'));
    await vi.advanceTimersByTimeAsync(0);
    expect(tasks).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
  });

  it('gives a task of its own, after the microtasks already queued', async () => {
    const watch = watchPage(document);
    const order: string[] = [];
    void Promise.resolve()
      .then(() => order.push('microtask'))
      .then(() => order.push('chained microtask'));
    await watch.task();
    order.push('task');
    expect(order).toEqual(['microtask', 'chained microtask', 'task']);
    watch.stop();
  });
});
