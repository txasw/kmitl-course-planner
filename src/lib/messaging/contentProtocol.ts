// The contract for messages the worker sends to a content script through
// tabs.sendMessage, and the acknowledgement the content script returns. It is the
// reverse direction of protocol.ts: the content router validates the command and
// the worker validates the ack, so neither side trusts what crosses the boundary.

import { z } from 'zod';

export const contentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('shell/openPanel') }),
]);

export type ContentMessage = z.infer<typeof contentMessageSchema>;

/**
 * The reply a content script sends once it has handled a command. The worker
 * counts a delivery only when the reply parses, because a tab without this
 * extension's content script answers nothing or rejects.
 */
export const contentAckSchema = z.object({ received: z.literal(true) });

export type ContentAck = z.infer<typeof contentAckSchema>;

export const CONTENT_ACK: ContentAck = { received: true };
