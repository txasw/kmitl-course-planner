import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRouter,
  setDebugDispatch,
  type HandlerContext,
  type HandlerMap,
  type MessageSender,
} from './router';
import type { RawFaculty } from '../domain/schemas';

const RUNTIME_ID = 'kcp-extension-id';
const sender = { id: RUNTIME_ID };

function facultyHandlers(): HandlerMap {
  return {
    'ref/faculty': () =>
      Promise.resolve({ ok: true as const, value: [] as RawFaculty[] }),
  };
}

describe('createRouter', () => {
  afterEach(() => {
    setDebugDispatch(null);
  });

  it('drops a message from a foreign sender', () => {
    const router = createRouter({ handlers: {}, runtimeId: RUNTIME_ID });
    expect(router({ type: 'ref/faculty' }, { id: 'other' })).toBeUndefined();
  });

  it('rejects a malformed message with a validation error', async () => {
    const router = createRouter({ handlers: {}, runtimeId: RUNTIME_ID });
    const result = await router({ type: 'nope' }, sender);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it('routes a valid message to its handler', async () => {
    const router = createRouter({
      handlers: facultyHandlers(),
      runtimeId: RUNTIME_ID,
    });
    const result = await router({ type: 'ref/faculty' }, sender);
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('returns an unknown error when no handler is registered', async () => {
    const router = createRouter({ handlers: {}, runtimeId: RUNTIME_ID });
    const result = await router({ type: 'ref/faculty' }, sender);
    expect(result).toMatchObject({ ok: false, error: { kind: 'unknown' } });
  });

  it('converts a handler throw into an unknown error', async () => {
    const router = createRouter({
      handlers: {
        'ref/faculty': () => Promise.reject(new Error('boom')),
      },
      runtimeId: RUNTIME_ID,
    });
    const result = await router({ type: 'ref/faculty' }, sender);
    expect(result).toMatchObject({ ok: false, error: { kind: 'unknown' } });
  });

  it('rejects the debug namespace outside a debug build', async () => {
    // Vitest builds with IS_DEBUG false, so even a registered dispatcher stays
    // unused: the production router refuses the whole debug namespace.
    const dispatch = vi.fn();
    setDebugDispatch(dispatch);
    const router = createRouter({ handlers: {}, runtimeId: RUNTIME_ID });
    const result = await router({ type: 'debug/getRequestLog' }, sender);
    expect(dispatch).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'debug routes disabled' },
    });
  });

  describe('handler context', () => {
    async function contextFor(
      routedSender: MessageSender,
    ): Promise<HandlerContext[]> {
      const seen: HandlerContext[] = [];
      const router = createRouter({
        handlers: {
          'ref/faculty': (_message, context) => {
            seen.push(context);
            return Promise.resolve({
              ok: true as const,
              value: [] as RawFaculty[],
            });
          },
        },
        runtimeId: RUNTIME_ID,
      });
      await router({ type: 'ref/faculty' }, routedSender);
      return seen;
    }

    it('passes the sender tab id to the handler', async () => {
      expect(await contextFor({ id: RUNTIME_ID, tab: { id: 7 } })).toEqual([
        { tabId: 7 },
      ]);
    });

    it('passes a null tab id when the sender is not a tab', async () => {
      expect(await contextFor(sender)).toEqual([{ tabId: null }]);
      expect(await contextFor({ id: RUNTIME_ID, tab: {} })).toEqual([
        { tabId: null },
      ]);
    });

    it('treats the no tab sentinel as no tab', async () => {
      expect(await contextFor({ id: RUNTIME_ID, tab: { id: -1 } })).toEqual([
        { tabId: null },
      ]);
    });

    it('still drops a foreign sender that carries a tab', () => {
      const router = createRouter({
        handlers: facultyHandlers(),
        runtimeId: RUNTIME_ID,
      });
      expect(
        router({ type: 'ref/faculty' }, { id: 'other', tab: { id: 7 } }),
      ).toBeUndefined();
    });
  });
});
