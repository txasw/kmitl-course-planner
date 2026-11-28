// The typed send, free of any transport. A program gives it the function that carries
// a message to its router, and gets back a client that returns the typed Result the
// router produced. A thrown transport, for example after the extension reloaded under
// an open page, maps to a NetworkError Result. The reply is checked against the Result
// envelope: a true ok flag with an optional value, or a false one carrying a valid
// tagged error. Anything else, such as the undefined a send resolves to when no
// listener answers, also maps to a NetworkError.
// The success value itself is not parsed again here, because the router built it
// from data it already validated; the caller never sees a raw exception.

import { err, networkError, type Result } from '../utils/result';
import {
  resultEnvelopeSchema,
  type CoreRequestMessage,
  type CoreResponseMap,
} from './protocol';
import type { TypedMessage } from './router';

/** Carries one message to a router and resolves to whatever came back. */
export type Transport = (message: unknown) => Promise<unknown>;

/** A response map whose every entry is a Result, as every router reply is. */
export type ResultMap<M extends TypedMessage> = Record<
  M['type'],
  Result<unknown>
>;

// The reply restated from its success value, so the network error built below is a
// valid reply for every request type without an assertion. For each concrete type it
// is the same Result the response map names.
type SuccessOf<R> = R extends { readonly ok: true; readonly value: infer V }
  ? V
  : never;
type Reply<R> = Result<SuccessOf<R>>;

/**
 * The typed send signature over a message union and its response map. UI code
 * depends on this shape rather than on a concrete client, so the real send is
 * injected at the entrypoint and a fake is injected in tests.
 */
export type TypedSend<M extends TypedMessage, R extends ResultMap<M>> = <
  T extends M['type'],
>(
  message: Extract<M, { type: T }>,
) => Promise<Reply<R[T]>>;

/**
 * The send over the core messages alone. Shared code that sends only core messages
 * takes this, so a program that carries the core protocol can supply its own send,
 * and the extension's send, whose union is wider, is assignable to it.
 */
export type CoreSend = TypedSend<CoreRequestMessage, CoreResponseMap>;

export function createSend<M extends TypedMessage, R extends ResultMap<M>>(
  transport: Transport,
): TypedSend<M, R> {
  return async <T extends M['type']>(
    message: Extract<M, { type: T }>,
  ): Promise<Reply<R[T]>> => {
    // Anything that is not a Result envelope, such as the undefined a missing
    // listener resolves to or a stray reply from another script, fails this guard.
    const isReply = (value: unknown): value is Reply<R[T]> =>
      resultEnvelopeSchema.safeParse(value).success;
    try {
      const response = await transport(message);
      return isReply(response)
        ? response
        : err(networkError('the background service sent a malformed reply'));
    } catch {
      return err(networkError('the background service is unavailable'));
    }
  };
}
