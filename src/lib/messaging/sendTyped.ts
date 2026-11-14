// The content side client. It sends a typed request across the worker boundary
// and returns the typed Result the worker produced. A thrown sendMessage (for
// example when the worker is not yet ready) and a reply that is not a Result
// envelope both map to a NetworkError Result, so the caller never sees a raw
// exception or an unchecked shape.

import { browser } from 'wxt/browser';
import { err, networkError } from '../utils/result';
import {
  resultEnvelopeSchema,
  type RequestMessage,
  type ResponseMap,
} from './protocol';

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
