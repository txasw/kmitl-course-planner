import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createRouter,
  setDebugDispatch,
  type HandlerContext,
  type HandlerMap,
  type MessageSender,
} from './router';
import type { RawFaculty } from '../domain/schemas';
import {
  requestMessageSchema,
  type RequestMessage,
  type ResponseMap,
} from './extensionProtocol';
import {
  coreRequestMessageSchema,
  type CoreRequestMessage,
  type CoreResponseMap,
} from './protocol';

const RUNTIME_ID = 'kcp-extension-id';
const sender = { id: RUNTIME_ID };

function facultyHandlers(): HandlerMap<RequestMessage, ResponseMap> {
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
    const router = createRouter({
      schema: requestMessageSchema,
      handlers: {},
      runtimeId: RUNTIME_ID,
    });
    expect(router({ type: 'ref/faculty' }, { id: 'other' })).toBeUndefined();
  });

  it('rejects a malformed message with a validation error', async () => {
    const router = createRouter({
      schema: requestMessageSchema,
      handlers: {},
      runtimeId: RUNTIME_ID,
    });
    const result = await router({ type: 'nope' }, sender);
    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } });
  });

  it('routes a valid message to its handler', async () => {
    const router = createRouter<RequestMessage, ResponseMap>({
      schema: requestMessageSchema,
      handlers: facultyHandlers(),
      runtimeId: RUNTIME_ID,
    });
    const result = await router({ type: 'ref/faculty' }, sender);
    expect(result).toEqual({ ok: true, value: [] });
  });

  it('returns an unknown error when no handler is registered', async () => {
    const router = createRouter({
      schema: requestMessageSchema,
      handlers: {},
      runtimeId: RUNTIME_ID,
    });
    const result = await router({ type: 'ref/faculty' }, sender);
    expect(result).toMatchObject({ ok: false, error: { kind: 'unknown' } });
  });

  it('converts a handler throw into an unknown error', async () => {
    const router = createRouter({
      schema: requestMessageSchema,
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
    const router = createRouter({
      schema: requestMessageSchema,
      handlers: {},
      runtimeId: RUNTIME_ID,
    });
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
      const router = createRouter<RequestMessage, ResponseMap>({
        schema: requestMessageSchema,
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
      const router = createRouter<RequestMessage, ResponseMap>({
        schema: requestMessageSchema,
        handlers: facultyHandlers(),
        runtimeId: RUNTIME_ID,
      });
      expect(
        router({ type: 'ref/faculty' }, { id: 'other', tab: { id: 7 } }),
      ).toBeUndefined();
    });
  });
});

describe('createRouter over the core and the extension schema', () => {
  const hostBuild = {
    type: 'regis/hostBuild',
    app: 'app.c0ffee01.js',
    vendors: 'chunk-vendors.7ab4925e.js',
  };

  function coreRouter() {
    const handlers: HandlerMap<CoreRequestMessage, CoreResponseMap> = {
      'ref/faculty': () =>
        Promise.resolve({ ok: true as const, value: [] as RawFaculty[] }),
    };
    return createRouter<CoreRequestMessage, CoreResponseMap>({
      schema: coreRequestMessageSchema,
      handlers,
      runtimeId: RUNTIME_ID,
    });
  }

  it('routes a core message with the core schema', async () => {
    expect(await coreRouter()({ type: 'ref/faculty' }, sender)).toEqual({
      ok: true,
      value: [],
    });
  });

  it('rejects the host check and the debug namespace as validation errors on the core schema', async () => {
    for (const message of [hostBuild, { type: 'debug/getRequestLog' }]) {
      expect(await coreRouter()(message, sender)).toMatchObject({
        ok: false,
        error: { kind: 'validation' },
      });
    }
  });

  it('routes the host check with the extension schema', async () => {
    const seen: unknown[] = [];
    const router = createRouter<RequestMessage, ResponseMap>({
      schema: requestMessageSchema,
      handlers: {
        'regis/hostBuild': (message) => {
          seen.push(message);
          return Promise.resolve({
            ok: true as const,
            value: { status: 'tested' as const },
          });
        },
      },
      runtimeId: RUNTIME_ID,
    });
    expect(await router(hostBuild, sender)).toEqual({
      ok: true,
      value: { status: 'tested' },
    });
    expect(seen).toEqual([hostBuild]);
  });

  it('checks a handler against the response map rather than inferring it', () => {
    interface WrongHandlers {
      'ref/faculty': () => Promise<number>;
    }
    // Left out, the response map defaults to never, so no handler widens it.
    expectTypeOf<WrongHandlers>().not.toExtend<
      Parameters<typeof createRouter<RequestMessage>>[0]['handlers']
    >();
    expectTypeOf<WrongHandlers>().not.toExtend<
      Parameters<
        typeof createRouter<RequestMessage, ResponseMap>
      >[0]['handlers']
    >();
  });

  it('types each handler map over its own union', () => {
    expectTypeOf<
      HandlerMap<CoreRequestMessage, CoreResponseMap>
    >().not.toHaveProperty('regis/hostBuild');
    expectTypeOf<
      HandlerMap<CoreRequestMessage, CoreResponseMap>
    >().not.toHaveProperty('debug/getReport');
    expectTypeOf<HandlerMap<RequestMessage, ResponseMap>>().toHaveProperty(
      'regis/hostBuild',
    );
    expectTypeOf<HandlerMap<RequestMessage, ResponseMap>>().toHaveProperty(
      'debug/getReport',
    );
  });
});
