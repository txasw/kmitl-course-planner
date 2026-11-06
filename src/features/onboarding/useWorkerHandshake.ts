// Binds this document to the worker (ADR-0062). On mount it starts listening for the
// worker's open command through the content router, and only then sends shell/mounted,
// so a worker that answers the handshake and then commands an open never finds the tab
// deaf. The reply is checked against its schema: a valid reply stores the open
// shortcut in words and, when the worker opened this tab for a toolbar click, opens
// the panel. Any other reply, or a failed send, settles the handshake with no open, so
// nothing waits on a worker that cannot answer. The listener goes away on unmount,
// which also follows the invalidation of the content script context, since WXT then
// removes the shadow root UI.

import { useEffect } from 'react';
import {
  createContentRouter,
  type ContentListener,
} from '@/lib/messaging/contentRouter';
import {
  mountedReplySchema,
  type RequestMessage,
} from '@/lib/messaging/protocol';
import { formatShortcut } from '@/lib/shell/shortcut';
import { openPanelAt } from '@/features/shell/openPanel';
import { onboardingStore } from './onboardingStore';

/** The runtime message event the content router listens on. */
export interface ContentMessageEvent {
  addListener(listener: ContentListener): void;
  removeListener(listener: ContentListener): void;
}

export interface WorkerHandshakeDeps {
  runtimeId: string;
  onMessage: ContentMessageEvent;
  /** Sends the handshake; the reply is untrusted until it parses. */
  send: (
    message: Extract<RequestMessage, { type: 'shell/mounted' }>,
  ) => Promise<unknown>;
}

/**
 * Opens the panel because the worker asked, from the handshake or a later command. It
 * closes a welcome that is showing, so the two never stack, and marks the document so
 * the entry prompts stay quiet and the welcome is not claimed here.
 */
export function applyRequestedOpen(): void {
  const onboarding = onboardingStore.getState();
  onboarding.markOpenRequested();
  onboarding.setWelcomeOpen(false);
  openPanelAt('resume');
}

function applyHandshakeReply(reply: unknown): void {
  const parsed = mountedReplySchema.safeParse(reply);
  const onboarding = onboardingStore.getState();
  if (parsed.success) {
    onboarding.setShortcut(formatShortcut(parsed.data.value.shortcut));
    if (parsed.data.value.openPanel) applyRequestedOpen();
  }
  onboarding.settleHandshake();
}

export function useWorkerHandshake({
  runtimeId,
  onMessage,
  send,
}: WorkerHandshakeDeps): void {
  useEffect(() => {
    let active = true;
    const listener = createContentRouter({
      runtimeId,
      onOpenPanel: applyRequestedOpen,
    });
    onMessage.addListener(listener);
    send({ type: 'shell/mounted' }).then(
      (reply) => {
        if (active) applyHandshakeReply(reply);
      },
      () => {
        if (active) onboardingStore.getState().settleHandshake();
      },
    );
    return () => {
      active = false;
      onMessage.removeListener(listener);
    };
  }, [runtimeId, onMessage, send]);
}
