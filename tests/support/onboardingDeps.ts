import type { OnboardingPersistenceDeps } from '../../src/features/onboarding/useOnboardingPersistence';
import type { WorkerHandshakeDeps } from '../../src/features/onboarding/useWorkerHandshake';
import type { WelcomeClaimDeps } from '../../src/features/onboarding/useWelcomeClaim';
import { TOUR_VERSION } from '../../src/lib/onboarding/tour';
import type { OnboardingRecord } from '../../src/lib/storage/onboarding';

// The product tour as already walked, so a test that opens the panel meets the panel
// rather than the tour's spotlight over it (ADR-0074).
const TOUR_DONE: OnboardingRecord = {
  schemaVersion: 1,
  tourSeen: {
    version: TOUR_VERSION,
    outcome: 'completed',
    at: '2026-11-06T08:00:00.000Z',
  },
};

/** Inert onboarding deps for tests that render the App shell but do not exercise
 * onboarding: there is no install record, the onboarding record holds only a walked
 * product tour, and a patch records nothing. */
export function fakeOnboardingDeps(): OnboardingPersistenceDeps {
  return {
    install: { load: () => Promise.resolve(null) },
    record: {
      load: () => Promise.resolve(TOUR_DONE),
      patch: () => Promise.resolve(TOUR_DONE),
    },
  };
}

/** Inert handshake deps: nothing listens, and the worker answers no open and no
 * shortcut. */
export function fakeHandshakeDeps(): WorkerHandshakeDeps {
  return {
    runtimeId: 'kcp-test-id',
    onMessage: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
    send: () =>
      Promise.resolve({
        ok: true,
        value: { openPanel: false, shortcut: null },
      }),
  };
}

/** Inert welcome claim deps: the onboarding record names no welcome and the worker
 * denies the claim. */
export function fakeWelcomeDeps(): WelcomeClaimDeps {
  return {
    record: fakeOnboardingDeps().record,
    send: () => Promise.resolve({ ok: true, value: { granted: false } }),
  };
}
