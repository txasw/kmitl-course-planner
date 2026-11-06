// A queue that runs async tasks one at a time in the order they were enqueued.
// The storage repositories use it so a read, merge, and write never interleaves
// with another one from the same document or worker. A failed task rejects its own
// caller only; the queue moves on to the next task.

export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task);
    tail = next.catch(() => undefined);
    return next;
  };
}
