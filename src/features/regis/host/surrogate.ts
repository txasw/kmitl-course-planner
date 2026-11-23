// Whether a staff member is viewing a student's registration page in surrogate mode,
// where the page belongs to another person and some host checks may be skipped. It is
// the one read of the page's web storage in KCP (ADR-0077): a presence check of one key
// whose value is never read. When the store cannot be read it answers yes, so the
// observer stays off rather than guessing.

const SURROGATE_KEY = 'surrogated_student_id';

export function isSurrogateSession(): boolean {
  try {
    return sessionStorage.getItem(SURROGATE_KEY) !== null;
  } catch {
    return true;
  }
}
