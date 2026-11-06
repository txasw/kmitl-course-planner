import { describe, expect, it, vi } from 'vitest';
import { contentAckSchema } from './contentProtocol';
import { createContentRouter } from './contentRouter';
import type { MessageSender } from './router';

const RUNTIME_ID = 'kcp-extension-id';
const workerSender: MessageSender = { id: RUNTIME_ID };

function setup() {
  const onOpenPanel = vi.fn();
  const sendResponse = vi.fn();
  const router = createContentRouter({ runtimeId: RUNTIME_ID, onOpenPanel });
  return { router, onOpenPanel, sendResponse };
}

describe('createContentRouter', () => {
  it('opens the panel and acknowledges synchronously', () => {
    const { router, onOpenPanel, sendResponse } = setup();
    const returned = router(
      { type: 'shell/openPanel' },
      workerSender,
      sendResponse,
    );
    expect(onOpenPanel).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ received: true });
    expect(returned).toBe(false);
  });

  it.each<[string, unknown, MessageSender]>([
    ['a foreign sender id', { type: 'shell/openPanel' }, { id: 'other' }],
    ['a sender without an id', { type: 'shell/openPanel' }, {}],
    [
      'a sender that carries a tab',
      { type: 'shell/openPanel' },
      { id: RUNTIME_ID, tab: { id: 7 } },
    ],
    ['an unknown type', { type: 'shell/closePanel' }, workerSender],
    ['a non object payload', 'shell/openPanel', workerSender],
    ['a missing payload', undefined, workerSender],
  ])('ignores %s', (_label, message, sender) => {
    const { router, onOpenPanel, sendResponse } = setup();
    expect(router(message, sender, sendResponse)).toBe(false);
    expect(onOpenPanel).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('sends no ack when the handler throws', () => {
    const sendResponse = vi.fn();
    const router = createContentRouter({
      runtimeId: RUNTIME_ID,
      onOpenPanel: () => {
        throw new Error('mount failed');
      },
    });
    expect(() =>
      router({ type: 'shell/openPanel' }, workerSender, sendResponse),
    ).toThrow('mount failed');
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

describe('contentAckSchema', () => {
  it('accepts the ack', () => {
    expect(contentAckSchema.safeParse({ received: true }).success).toBe(true);
  });

  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['an empty object', {}],
    ['a string flag', { received: 'yes' }],
    ['a false flag', { received: false }],
  ])('rejects %s', (_label, reply) => {
    expect(contentAckSchema.safeParse(reply).success).toBe(false);
  });
});
