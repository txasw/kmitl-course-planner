// The handlers of the core messages that reach the gateway: the five reference lists
// and the teach table query and its cancel. Every program that routes the core
// protocol spreads this map, so no handler is restated. The message itself is the
// load options, since its refresh, noRetry, and cacheOnly fields are what the
// gateway reads.

import {
  currentTermEndpoint,
  curriculumEndpoint,
  departmentEndpoint,
  facultyEndpoint,
  subjectOwnerEndpoint,
} from './endpoints';
import type { Gateway } from './gateway';
import type {
  CoreRequestMessage,
  CoreResponseMap,
} from '../messaging/protocol';
import type { HandlerContext } from '../messaging/router';
import { ok } from '../utils/result';

/** The core message types whose answer comes from the gateway. */
type GatewayType = Extract<
  CoreRequestMessage['type'],
  `ref/${string}` | `teachTable/${string}`
>;

// Every key is required, so the map spreads into a wider handler map whose entries
// are optional without widening any of them to undefined. Each entry is spelled out
// rather than named through the generic Handler, which would compare the two message
// unions instead of the one message each entry takes.
export type CoreHandlers = {
  [T in GatewayType]: (
    message: Extract<CoreRequestMessage, { type: T }>,
    context: HandlerContext,
  ) => Promise<CoreResponseMap[T]>;
};

export function createCoreHandlers(gateway: Gateway): CoreHandlers {
  return {
    'ref/faculty': (message) => gateway.reference(facultyEndpoint, message),
    'ref/department': (message) =>
      gateway.reference(departmentEndpoint, message),
    'ref/curriculum': (message) =>
      gateway.reference(curriculumEndpoint, message),
    'ref/subjectOwner': (message) =>
      gateway.reference(subjectOwnerEndpoint, message),
    'ref/currentTerm': (message) =>
      gateway.reference(currentTermEndpoint, message),
    'teachTable/query': (message) => gateway.teachTable(message.query, message),
    'teachTable/cancel': (message) => {
      gateway.cancelTeachTable(message.query);
      return Promise.resolve(ok(undefined));
    },
  };
}
