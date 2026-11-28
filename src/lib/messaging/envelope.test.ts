import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createSend,
  type CoreSend,
  type Transport,
  type TypedSend,
} from './envelope';
import type { CoreRequestMessage, CoreResponseMap } from './protocol';
import type { RequestMessage, ResponseMap } from './extensionProtocol';

function sendOver(reply: Transport) {
  const transport = vi.fn(reply);
  return {
    transport,
    send: createSend<CoreRequestMessage, CoreResponseMap>(transport),
  };
}

describe('createSend', () => {
  it('hands the message to the transport and returns its reply', async () => {
    const { transport, send } = sendOver(() =>
      Promise.resolve({ ok: true, value: [] }),
    );
    const result = await send({ type: 'ref/faculty', refresh: true });
    expect(transport).toHaveBeenCalledWith({
      type: 'ref/faculty',
      refresh: true,
    });
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
    const { send } = sendOver(() => Promise.resolve(reply));
    expect(await send({ type: 'ref/faculty' })).toBe(reply);
  });

  it('accepts a void success reply with no value key', async () => {
    const { send } = sendOver(() => Promise.resolve({ ok: true }));
    const query = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      search_all_faculty: false,
      selected_subject_owner_id: '32',
    } as const;
    expect(await send({ type: 'teachTable/cancel', query })).toEqual({
      ok: true,
    });
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
      const { send } = sendOver(() => Promise.resolve(reply));
      expect(await send({ type: 'ref/faculty' })).toEqual({
        ok: false,
        error: {
          kind: 'network',
          message: 'the background service sent a malformed reply',
        },
      });
    },
  );

  it.each([
    ['rejects', () => Promise.reject(new Error('no receiver'))],
    [
      'throws before it returns',
      () => {
        throw new Error('no receiver');
      },
    ],
  ])('maps a transport that %s to a network error', async (_label, reply) => {
    const { send } = sendOver(reply);
    expect(await send({ type: 'ref/faculty' })).toEqual({
      ok: false,
      error: {
        kind: 'network',
        message: 'the background service is unavailable',
      },
    });
  });

  it('types each reply by the response map it was built over', () => {
    const { send } = sendOver(() => Promise.resolve({ ok: true, value: [] }));
    expectTypeOf(send({ type: 'ref/faculty' })).resolves.toEqualTypeOf<
      CoreResponseMap['ref/faculty']
    >();
    type ExtensionSend = TypedSend<RequestMessage, ResponseMap>;
    expectTypeOf<Parameters<CoreSend>[0]>().toEqualTypeOf<CoreRequestMessage>();
    expectTypeOf<
      Parameters<ExtensionSend>[0]
    >().toEqualTypeOf<RequestMessage>();
    expectTypeOf<
      Extract<RequestMessage, { type: 'regis/hostBuild' }>
    >().not.toExtend<Parameters<CoreSend>[0]>();
  });

  it('lets a wider send stand in where shared code takes the core send', () => {
    type ExtensionSend = TypedSend<RequestMessage, ResponseMap>;
    expectTypeOf(
      sendOver(() => Promise.resolve(null)).send,
    ).toEqualTypeOf<CoreSend>();
    expectTypeOf<ExtensionSend>().toExtend<CoreSend>();
    expectTypeOf<CoreSend>().not.toExtend<ExtensionSend>();
  });
});
