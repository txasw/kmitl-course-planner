// Decides once per document whether it shows the welcome after install (ADR-0062). It
// waits until both stored records are read and the mount handshake has settled, then
// asks the worker only when the install record exists, no welcome has been shown on a
// fresh read of the onboarding record, the worker did not ask this document to open the
// panel, and the document is visible. A hidden document, such as a regis tab Firefox
// injects into behind the install tab, waits for its first change to visible, so the
// welcome never shows where nobody sees it.
//
// The worker's reply is untrusted until it parses. On a grant welcomeShownAt is written
// before the welcome opens, so a reload while it shows does not show it again; the
// welcome is meant for exactly one visit. A worker open that arrives while the claim is
// in flight wins and nothing is written, so the welcome stays pending; since the worker
// has already recorded its one grant for this browser session, it shows again only in
// a document of a later session. Every path, a denial, a failed send, or a storage
// fault included, settles the decision, so the entry prompts that wait on it never
// wait forever.

import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import {
  claimWelcomeReplySchema,
  type RequestMessage,
} from '@/lib/messaging/protocol';
import type { OnboardingRepository } from '@/lib/storage/onboarding';
import { onboardingStore } from './onboardingStore';

export interface WelcomeClaimDeps {
  record: OnboardingRepository;
  /** Sends the claim; the reply is untrusted until it parses. */
  send: (
    message: Extract<RequestMessage, { type: 'onboarding/claimWelcome' }>,
  ) => Promise<unknown>;
}

function mayClaim(): boolean {
  const { install, record, openRequested } = onboardingStore.getState();
  return (
    install !== null && record.welcomeShownAt === undefined && !openRequested
  );
}

async function claimWelcome(
  { record, send }: WelcomeClaimDeps,
  isActive: () => boolean,
): Promise<void> {
  // Checked again here, since a hidden document may have opened the panel by then.
  if (!mayClaim()) return;
  const fresh = await record.load();
  if (!isActive() || fresh.welcomeShownAt !== undefined) return;
  const reply = claimWelcomeReplySchema.safeParse(
    await send({ type: 'onboarding/claimWelcome' }),
  );
  if (!isActive() || !reply.success || !reply.data.value.granted) return;
  if (onboardingStore.getState().openRequested) return;
  const merged = await record.patch({
    welcomeShownAt: new Date().toISOString(),
  });
  if (!isActive()) return;
  const store = onboardingStore.getState();
  store.setRecord(merged);
  if (store.openRequested) return;
  store.suppressDocument();
  store.setWelcomeOpen(true);
}

export function useWelcomeClaim({ record, send }: WelcomeClaimDeps): void {
  const loaded = useStore(onboardingStore, (state) => state.loaded);
  const handshakeSettled = useStore(
    onboardingStore,
    (state) => state.handshakeSettled,
  );
  const ready = loaded && handshakeSettled;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ready || startedRef.current) return undefined;
    startedRef.current = true;
    let active = true;
    const isActive = () => active;
    const settle = () => {
      if (active) onboardingStore.getState().settleWelcome();
    };

    if (!mayClaim()) {
      settle();
      return undefined;
    }

    const run = () => {
      void claimWelcome({ record, send }, isActive)
        .catch(() => undefined)
        .finally(settle);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', handleVisibility);
      run();
    };

    if (document.visibilityState === 'visible') {
      run();
    } else {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [ready, record, send]);
}
