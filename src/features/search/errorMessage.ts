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
      return 'error.http';
    case 'validation':
      return 'error.validation';
    case 'storage':
      return 'error.storage';
    case 'unknown':
      return 'error.unknown';
  }
}
