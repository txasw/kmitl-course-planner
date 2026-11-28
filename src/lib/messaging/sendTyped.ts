// The content side client. It sends a typed request across the worker boundary
// and returns the typed Result the worker produced. A thrown sendMessage, for
// example after the extension reloaded under an open page, maps to a NetworkError
// Result. The reply is checked against the Result envelope: a true ok flag with
// an optional value, or a false one carrying a valid tagged error. Anything else,
// such as the undefined a send resolves to when no listener answers, also maps to
// a NetworkError.
// The success value itself is not parsed again here, because the worker built it
// from data it already validated; the caller never sees a raw exception.

import { browser } from 'wxt/browser';
import { err, networkError } from '../utils/result';
import { resultEnvelopeSchema } from './protocol';
import type { RequestMessage, ResponseMap } from './extensionProtocol';

export async function sendTyped<T extends RequestMessage['type']>(
  message: Extract<RequestMessage, { type: T }>,
): Promise<ResponseMap[T]> {
  // Anything that is not a Result envelope, such as the undefined a missing
  // listener resolves to or a stray reply from another script, fails this guard.
  const isReply = (value: unknown): value is ResponseMap[T] =>
    resultEnvelopeSchema.safeParse(value).success;
  try {
    // sendMessage is typed as returning any by the polyfill, so the reply is held
    // as unknown and checked against the Result envelope before it is returned.
    const response: unknown = await browser.runtime.sendMessage(message);
    return isReply(response)
      ? response
      : err(networkError('the background service sent a malformed reply'));
  } catch {
    return err(networkError('the background service is unavailable'));
  }
}

/**
 * The typed send signature. UI code depends on this shape rather than importing
 * the concrete client, so the real sendTyped is injected at the entrypoint and a
 * fake is injected in tests without mocking the browser polyfill.
 */
export type TypedSend = typeof sendTyped;
