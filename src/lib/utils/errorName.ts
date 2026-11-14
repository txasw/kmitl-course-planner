// The name of a thrown value, read without trusting its prototype. An error raised in
// another realm, such as a DOMException from a page API reached through a Firefox content
// script's Xray wrapper, fails instanceof against this realm's classes, so the name is
// also read from any object that carries one.

/** The name of a thrown value, or an empty string when it carries none. */
export function errorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return typeof error.name === 'string' ? error.name : '';
  }
  return '';
}
