// The content side client. It sends a typed request across the worker boundary
// and returns the typed Result the worker produced. A thrown sendMessage (for
// example when the worker is not yet ready) is mapped to a NetworkError Result so
// the caller never sees a raw exception. This module is created for later phases;
// no component mounts it yet.

import { browser } from 'wxt/browser';
import { err, networkError } from '../utils/result';
import type { RequestMessage, ResponseMap } from './protocol';

export async function sendTyped<T extends RequestMessage['type']>(
  message: Extract<RequestMessage, { type: T }>,
): Promise<ResponseMap[T]> {
  try {
    // sendMessage is typed as returning any by the polyfill, so narrow through
    // unknown before asserting the response shape.
    const response: unknown = await browser.runtime.sendMessage(message);
    return response as ResponseMap[T];
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
