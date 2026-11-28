// The request policy of quiet mode, the behaviour on the host registration pages
// (ADR-0075). There KCP starts nothing on its own: no plan check on open or on a plan
// switch, and no reference list or default term from the network, so an automatic
// reference read is served from the worker cache alone. A request the student asks
// for, a search or a check, still runs, but once: a failure is final rather than
// retried, since a retry adds load at the moment the registrar can least take it.
// Whether the page is quiet is read when each request starts, so leaving the page
// restores the normal behaviour for the next one.

import type { RequestMessage } from '../messaging/protocol';
import type { TypedSend } from '../messaging/sendTyped';

/** The requests that can reach the network, which are the ones a retry repeats. */
const NETWORK_TYPES: ReadonlySet<RequestMessage['type']> = new Set([
  'ref/faculty',
  'ref/department',
  'ref/curriculum',
  'ref/subjectOwner',
  'ref/currentTerm',
  'teachTable/query',
]);

type ReferenceMessage = Extract<RequestMessage, { type: `ref/${string}` }>;

/** The message with retries turned off when it can reach the network. */
export function withoutRetry<M extends RequestMessage>(message: M): M {
  return NETWORK_TYPES.has(message.type)
    ? { ...message, noRetry: true }
    : message;
}

/** A send that turns retries off for every request started while the page is quiet. */
export function quietAwareSend(
  send: TypedSend,
  isQuiet: () => boolean,
): TypedSend {
  return (message) => send(isQuiet() ? withoutRetry(message) : message);
}

/**
 * The message an automatic reference read sends: unchanged on other pages, and served
 * from the cache alone while the page is quiet.
 */
export function automaticReferenceRead<M extends ReferenceMessage>(
  message: M,
  quiet: boolean,
): M {
  return quiet ? { ...message, cacheOnly: true } : message;
}
