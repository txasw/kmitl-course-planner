import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serialQueue';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('createSerialQueue', () => {
  it('starts a task only after the previous one settles', async () => {
    const enqueue = createSerialQueue();
    const order: string[] = [];
    const gate = deferred();
    const first = enqueue(async () => {
      order.push('first start');
      await gate.promise;
      order.push('first end');
      return 1;
    });
    const second = enqueue(() => {
      order.push('second');
      return Promise.resolve(2);
    });
    await Promise.resolve();
    expect(order).toEqual(['first start']);
    gate.resolve();
    expect(await Promise.all([first, second])).toEqual([1, 2]);
    expect(order).toEqual(['first start', 'first end', 'second']);
  });

  it('rejects only the failed task and runs the next one', async () => {
    const enqueue = createSerialQueue();
    const failed = enqueue(() => Promise.reject(new Error('write failed')));
    const next = enqueue(() => Promise.resolve('next'));
    await expect(failed).rejects.toThrow('write failed');
    expect(await next).toBe('next');
  });

  it('keeps separate queues independent', async () => {
    const blocked = createSerialQueue();
    const free = createSerialQueue();
    const gate = deferred();
    const held = blocked(() => gate.promise);
    expect(await free(() => Promise.resolve('free'))).toBe('free');
    gate.resolve();
    await held;
  });
});
