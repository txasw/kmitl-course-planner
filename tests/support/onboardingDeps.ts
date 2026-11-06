import type { OnboardingPersistenceDeps } from '../../src/features/onboarding/useOnboardingPersistence';

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
