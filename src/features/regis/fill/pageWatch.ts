// How a fill run waits for the host (ADR-0078, the timing amendment). A wait ends at the
// first task after the page changes, so each step is verified as soon as the host has
// answered rather than at the next tick of a clock, and a timer ends it at the latest so
// the run still reads the Stop press and its ceilings when the page stays still.
//
// The check runs one task after the change, never inside the mutation callback: the host
// is Vue 2, which renders in a microtask and can chain more microtasks after it, such as
// the async section check that colours the add row, or the move of a dialog to the app
// root on the next tick. All of them end before the next task begins, so a reading there
// sees the host's whole answer. The task is a message on a channel of KCP's own, which a
// browser does not throttle in a tab in the background the way it throttles timers.
// What changed is not looked at; the run reads the page again from the start.

export interface PageWatch {
  /** Resolves at the first task after the page changes, or after `ms` at the latest. */
  change: (ms: number) => Promise<void>;
  /** Resolves at the next task, after the work already queued. */
  task: () => Promise<void>;
  stop: () => void;
}

function channelTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

export function watchPage(
  doc: Document,
  nextTask: () => Promise<void> = channelTask,
): PageWatch {
  let waiting: (() => void)[] = [];
  let due = false;
  const wake = () => {
    due = false;
    const ready = waiting;
    waiting = [];
    for (const resolve of ready) resolve();
  };
  const observer = new MutationObserver(() => {
    if (due || waiting.length === 0) return;
    due = true;
    void nextTask().then(wake);
  });
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  return {
    change: (ms) =>
      new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer);
          waiting = waiting.filter((other) => other !== done);
          resolve();
        };
        const timer = setTimeout(done, ms);
        waiting.push(done);
      }),
    task: nextTask,
    stop: () => {
      observer.disconnect();
      wake();
    },
  };
}
