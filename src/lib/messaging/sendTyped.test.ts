import { afterEach, describe, expect, it, vi } from 'vitest';

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage } } }));

import { sendTyped } from './sendTyped';

// The reply checks live in envelope.test.ts; these cover the runtime messaging wiring.
describe('sendTyped', () => {
  afterEach(() => {
    sendMessage.mockReset();
  });

  it('forwards the message and returns the worker response', async () => {
    sendMessage.mockResolvedValue({ ok: true, value: [] });
    const result = await sendTyped({ type: 'ref/faculty' });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'ref/faculty' });
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('carries an extension only message', async () => {
    sendMessage.mockResolvedValue({ ok: true });
    const result = await sendTyped({ type: 'debug/clearCache' });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'debug/clearCache' });
    expect(result).toEqual({ ok: true });
  });

  it('maps a malformed reply to a network error', async () => {
    sendMessage.mockResolvedValue(undefined);
    const result = await sendTyped({ type: 'ref/faculty' });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'network',
        message: 'the background service sent a malformed reply',
      },
    });
  });

  it('maps an unavailable worker to a network error', async () => {
    sendMessage.mockRejectedValue(new Error('no receiver'));
    const result = await sendTyped({ type: 'ref/faculty' });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'network',
        message: 'the background service is unavailable',
      },
    });
  });
});
