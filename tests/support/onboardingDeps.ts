import type { OnboardingPersistenceDeps } from '../../src/features/onboarding/useOnboardingPersistence';
import type { WorkerHandshakeDeps } from '../../src/features/onboarding/useWorkerHandshake';
import type { WelcomeClaimDeps } from '../../src/features/onboarding/useWelcomeClaim';

/** Inert onboarding deps for tests that render the App shell but do not exercise
 * onboarding: there is no install record, the onboarding record is empty, and a
 * patch records nothing. */
export function fakeOnboardingDeps(): OnboardingPersistenceDeps {
  return {
    install: { load: () => Promise.resolve(null) },
    record: {
      load: () => Promise.resolve({ schemaVersion: 1 }),
      patch: () => Promise.resolve({ schemaVersion: 1 }),
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

/** Inert welcome claim deps: the onboarding record is empty and the worker denies
 * the claim. */
export function fakeWelcomeDeps(): WelcomeClaimDeps {
  return {
    record: fakeOnboardingDeps().record,
    send: () => Promise.resolve({ ok: true, value: { granted: false } }),
  };
}
