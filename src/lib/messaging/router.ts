// The worker side message router. It validates the sender identity, validates the
// inbound payload against the request schema, and dispatches to a typed handler.
// The debug namespace is refused outright unless this is a debug build with a
// dispatcher installed, so production actively rejects debug routes as defense in
// depth. Any handler throw is converted to an UnknownError so no raw exception
// crosses the messaging boundary. The runtime id is injected rather than read from
// browser globals, which keeps this module pure and unit testable.

import {
  err,
  unknownError,
  validationError,
  type Result,
} from '../utils/result';
import { IS_DEBUG } from '../env';
import {
  requestMessageSchema,
  type RequestMessage,
  type RequestType,
  type ResponseMap,
} from './protocol';

/** The subset of a runtime message sender the router inspects. */
export interface MessageSender {
  id?: string;
}

export type RouterListener = (
  message: unknown,
  sender: MessageSender,
) => Promise<unknown> | undefined;

export type Handler<T extends RequestType> = (
  message: Extract<RequestMessage, { type: T }>,
) => Promise<ResponseMap[T]>;

export type HandlerMap = { [T in RequestType]?: Handler<T> };

/** Handles debug namespace messages; installed only by the debug build. */
export type DebugDispatch = (message: RequestMessage) => Promise<unknown>;

let debugDispatch: DebugDispatch | null = null;

export function setDebugDispatch(dispatch: DebugDispatch | null): void {
  debugDispatch = dispatch;
}

export interface RouterDeps {
  handlers: HandlerMap;
  runtimeId: string;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'handler failed';
}

function toValidationError(
  issues: { path: PropertyKey[]; message: string }[],
): Result<never> {
  return err(
    validationError(
      issues.map((issue) => ({
        path: issue.path.map((segment) => String(segment)).join('.'),
        message: issue.message,
      })),
    ),
  );
}

export function createRouter({
  handlers,
  runtimeId,
}: RouterDeps): RouterListener {
  return (message, sender) => {
    // A message from any context other than this extension is dropped without a
    // response channel, which is the defense against foreign senders.
    if (sender.id !== runtimeId) {
      return undefined;
    }
    const parsed = requestMessageSchema.safeParse(message);
    if (!parsed.success) {
      return Promise.resolve(toValidationError(parsed.error.issues));
    }
    const request = parsed.data;
    if (request.type.startsWith('debug/')) {
      if (IS_DEBUG && debugDispatch) {
        return debugDispatch(request).catch((error: unknown) =>
          err(unknownError(messageOf(error))),
        );
      }
      return Promise.resolve(err(unknownError('debug routes disabled')));
    }
    const handler = handlers[request.type] as
      ((message: RequestMessage) => Promise<unknown>) | undefined;
    if (!handler) {
      return Promise.resolve(
        err(unknownError(`no handler for ${request.type}`)),
      );
    }
    return handler(request).catch((error: unknown) =>
      err(unknownError(messageOf(error))),
    );
  };
}
