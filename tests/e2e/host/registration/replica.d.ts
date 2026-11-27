// Types for the plain JavaScript regular registration replica, so the unit tests and the
// specs drive it typed.

export type RegistrationState = 'REGIS' | 'SUMMARY_REGIS' | 'closed';

export interface RegistrationReplica {
  page: { state: RegistrationState; term: { semester: string; year: string } };
  counters: { clicks: Record<string, number>; untrusted: number };
  set(state: RegistrationState): void;
  interactions(): number;
}

export function mountRegistration(
  doc: Document,
  options?: {
    state?: RegistrationState;
    term?: { semester: string; year: string };
  },
): RegistrationReplica;
