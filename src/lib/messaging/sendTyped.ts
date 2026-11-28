// The content side client: the transport free send of envelope.ts over runtime
// messaging, typed by the extension's whole protocol.

import { browser } from 'wxt/browser';
import { createSend, type TypedSend as SendOver } from './envelope';
import type { RequestMessage, ResponseMap } from './extensionProtocol';

// sendMessage is typed as returning any by the polyfill, so the reply is held as
// unknown and checked against the Result envelope before it is returned.
export const sendTyped = createSend<RequestMessage, ResponseMap>(
  (message): Promise<unknown> => browser.runtime.sendMessage(message),
);

/** The extension's typed send signature, which UI code takes as a dependency. */
export type TypedSend = SendOver<RequestMessage, ResponseMap>;
