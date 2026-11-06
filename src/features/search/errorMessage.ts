// Map a typed gateway error to a one sentence translation key, so every error
// surface renders a concise, localized message rather than a raw error, and to the
// one action that can resolve it.

import type { TranslationKey } from '@/lib/i18n/t';
import type { ApiError } from '@/lib/utils/result';

// A 400 naming the subject id length is the server's exact rejection for an id that is
// not eight digits. The client gate prevents it, so this is a safety net for a value
// that reached the wire past the field, such as a persisted or imported search.
function rejectsSubjectId(error: ApiError): boolean {
  return (
    error.kind === 'http' &&
    error.status === 400 &&
    error.fields?.selected_subject_id !== undefined
  );
}

export function errorMessageKey(error: ApiError): TranslationKey {
  switch (error.kind) {
    case 'network':
      return 'error.network';
    case 'timeout':
      return 'error.timeout';
    case 'http':
      return rejectsSubjectId(error) ? 'error.subjectIdLength' : 'error.http';
    case 'validation':
      return 'error.validation';
    case 'storage':
      return 'error.storage';
    case 'unknown':
      return 'error.unknown';
  }
}

/**
 * The action an error card offers. The server rejects a 400 or 404 query the same way
 * on every attempt, so asking again cannot help and the card opens the form instead; a
 * subject id rejection goes straight to that field. Every other failure, such as a
 * network drop, a timeout, a rate limit or a server fault, may pass on a later attempt
 * and keeps the retry.
 */
export type ErrorAction = 'retry' | 'editSearch' | 'editSubjectId';

export function errorAction(error: ApiError): ErrorAction {
  if (rejectsSubjectId(error)) {
    return 'editSubjectId';
  }
  if (error.kind === 'http' && (error.status === 400 || error.status === 404)) {
    return 'editSearch';
  }
  return 'retry';
}
