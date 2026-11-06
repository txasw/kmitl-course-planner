// The content side message router. Only the worker may command a content script,
// so a message counts only when its sender is this extension and carries no tab:
// an extension page open in a tab can also message a content script, and it
// arrives with that tab attached. The payload is validated before any handler
// runs. The ack goes out synchronously through sendResponse and the listener
// returns false, because Chrome does not accept a promise returned from
// onMessage and a listener that never responds leaves the worker waiting on a
// closed channel.

import {
  CONTENT_ACK,
  contentMessageSchema,
  type ContentAck,
} from './contentProtocol';
import type { MessageSender } from './router';

export interface ContentRouterDeps {
  runtimeId: string;
  onOpenPanel: () => void;
}

export type ContentListener = (
  message: unknown,
  sender: MessageSender,
  sendResponse: (response: ContentAck) => void,
) => false;

export function createContentRouter({
  runtimeId,
  onOpenPanel,
}: ContentRouterDeps): ContentListener {
  return (message, sender, sendResponse) => {
    if (sender.id !== runtimeId || sender.tab !== undefined) {
      return false;
    }
    // shell/openPanel is the only command, so a valid message is that command.
    if (!contentMessageSchema.safeParse(message).success) {
      return false;
    }
    // The ack follows the handler, so a handler that throws sends none and the
    // worker treats the tab as one that did not answer.
    onOpenPanel();
    sendResponse(CONTENT_ACK);
    return false;
  };
}
