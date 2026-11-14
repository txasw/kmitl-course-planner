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

  it('passes a typed error reply through unchanged', async () => {
    const reply = {
      ok: false,
      error: {
        kind: 'http',
        status: 400,
        message: 'bad',
        fields: { a: ['b'] },
      },
    };
    sendMessage.mockResolvedValue(reply);
    const result = await sendTyped({ type: 'ref/faculty' });
    expect(result).toBe(reply);
  });

  it('accepts a void success reply with no value key', async () => {
    sendMessage.mockResolvedValue({ ok: true });
    const result = await sendTyped({ type: 'debug/clearCache' });
    expect(result).toEqual({ ok: true });
  });

  it.each([
    ['undefined, as a missing listener resolves', undefined],
    ['null', null],
    ['a bare value', []],
    ['an object with no ok flag', { value: [] }],
    ['a non boolean ok flag', { ok: 'true', value: [] }],
    ['an error with an unknown kind', { ok: false, error: { kind: 'boom' } }],
    ['an error with no message', { ok: false, error: { kind: 'network' } }],
    ['a failure with no error', { ok: false }],
  ])(
    'maps a malformed reply (%s) to a network error',
    async (_label, reply) => {
      sendMessage.mockResolvedValue(reply);
      const result = await sendTyped({ type: 'ref/faculty' });
      expect(result).toEqual({
        ok: false,
        error: {
          kind: 'network',
          message: 'the background service sent a malformed reply',
        },
      });
    },
  );

  it('maps an unavailable worker to a network error', async () => {
    sendMessage.mockRejectedValue(new Error('no receiver'));
    const result = await sendTyped({ type: 'ref/faculty' });
    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } });
  });
});
