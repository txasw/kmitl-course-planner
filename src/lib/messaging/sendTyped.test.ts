import { afterEach, describe, expect, it, vi } from 'vitest';

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage } } }));

import { sendTyped } from './sendTyped';

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

  it('maps an unavailable worker to a network error', async () => {
    sendMessage.mockRejectedValue(new Error('no receiver'));
    const result = await sendTyped({ type: 'ref/faculty' });
    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } });
  });
});
