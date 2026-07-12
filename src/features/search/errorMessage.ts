// Map a typed gateway error to a one sentence translation key, so every error
// surface renders a concise, localized message rather than a raw error.

import type { TranslationKey } from '@/lib/i18n/t';
import type { ApiError } from '@/lib/utils/result';

export function errorMessageKey(error: ApiError): TranslationKey {
  switch (error.kind) {
    case 'network':
      return 'error.network';
    case 'timeout':
      return 'error.timeout';
    case 'http':
      // A 400 naming the subject id length is the server's exact rejection for an
      // id that is not eight digits. The client gate prevents it, so this is a
      // safety net for a value that reached the wire past the field, such as a
      // persisted or imported search.
      if (error.status === 400 && error.fields?.selected_subject_id) {
        return 'error.subjectIdLength';
      }
      return 'error.http';
    case 'validation':
      return 'error.validation';
    case 'storage':
      return 'error.storage';
    case 'unknown':
      return 'error.unknown';
  }
}
