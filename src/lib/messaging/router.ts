// The worker side message router. It validates the sender identity, validates the
// inbound payload against the request schema it is given, and dispatches to a typed
// handler. It is generic over the message union, so the extension routes its full
// protocol and a smaller program can route the core one with the same code.
// The debug namespace is refused outright unless this is a debug build with a
// dispatcher installed, so production actively rejects debug routes as defense in
// depth. Any handler throw is converted to an UnknownError so no raw exception
// crosses the messaging boundary. The runtime id is injected rather than read from
// browser globals, which keeps this module pure and unit testable. Each handler
// also receives the id of the tab the message came from, so a handler can answer
// with state the worker keeps per tab.

import type { z } from 'zod';
import {
  err,
  unknownError,
  validationError,
  type Result,
} from '../utils/result';
import { IS_DEBUG } from '../env';

/** What every request union shares: a string discriminant named type. */
export interface TypedMessage {
  type: string;
}

/** A response map keyed by each type of a message union. */
export type ResponsesOf<M extends TypedMessage> = Record<M['type'], unknown>;

/** The subset of a runtime message sender the router inspects. */
export interface MessageSender {
  id?: string;
  // The browser types declare both optional fields as possibly undefined.
  tab?: { id?: number | undefined } | undefined;
}

/** What the router knows about the origin of a message beyond its payload. */
export interface HandlerContext {
  /** The sending tab, or null when the sender is not a tab. */
  tabId: number | null;
}

export type RouterListener = (
  message: unknown,
  sender: MessageSender,
) => Promise<unknown> | undefined;

// A handler that ignores the context still satisfies this type, because a function
// with fewer parameters is assignable to one with more.
export type Handler<
  M extends TypedMessage,
  R extends ResponsesOf<M>,
  T extends M['type'],
> = (
  message: Extract<M, { type: T }>,
  context: HandlerContext,
) => Promise<R[T]>;

export type HandlerMap<M extends TypedMessage, R extends ResponsesOf<M>> = {
  [T in M['type']]?: Handler<M, R, T>;
};

/**
 * Handles debug namespace messages; installed only by the debug build. It takes the
 * message as unknown and checks it against its own schema, so the router needs no
 * knowledge of the debug union.
 */
export type DebugDispatch = (message: unknown) => Promise<unknown>;

let debugDispatch: DebugDispatch | null = null;

export function setDebugDispatch(dispatch: DebugDispatch | null): void {
  debugDispatch = dispatch;
}

// The response map is never inferred from the handlers, so a handler written inline
// is checked against the protocol's real response types. A caller names it as an
// explicit type argument; left out, it defaults to never, and any handler then fails
// to compile rather than widening to unknown.
export interface RouterDeps<M extends TypedMessage, R extends ResponsesOf<M>> {
  schema: z.ZodType<M>;
  handlers: HandlerMap<M, NoInfer<R>>;
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

/**
 * Whether a tab id names a real tab. Chrome reports tabs.TAB_ID_NONE (-1) for a
 * sender or a click outside a browser tab, so only a non negative integer counts.
 */
export function isTabId(id: number | undefined): id is number {
  return id !== undefined && Number.isInteger(id) && id >= 0;
}

function contextOf(sender: MessageSender): HandlerContext {
  const tabId = sender.tab?.id;
  return { tabId: isTabId(tabId) ? tabId : null };
}

export function createRouter<
  M extends TypedMessage,
  R extends ResponsesOf<M> = never,
>({ schema, handlers, runtimeId }: RouterDeps<M, R>): RouterListener {
  return (message, sender) => {
    // A message from any context other than this extension is dropped without a
    // response channel, which is the defense against foreign senders.
    if (sender.id !== runtimeId) {
      return undefined;
    }
    const parsed = schema.safeParse(message);
    if (!parsed.success) {
      return Promise.resolve(toValidationError(parsed.error.issues));
    }
    const request = parsed.data;
    const type: M['type'] = request.type;
    if (type.startsWith('debug/')) {
      if (IS_DEBUG && debugDispatch) {
        return debugDispatch(request).catch((error: unknown) =>
          err(unknownError(messageOf(error))),
        );
      }
      return Promise.resolve(err(unknownError('debug routes disabled')));
    }
    const handler = handlers[type] as
      ((message: M, context: HandlerContext) => Promise<unknown>) | undefined;
    if (!handler) {
      return Promise.resolve(err(unknownError(`no handler for ${type}`)));
    }
    return handler(request, contextOf(sender)).catch((error: unknown) =>
      err(unknownError(messageOf(error))),
    );
  };
}
