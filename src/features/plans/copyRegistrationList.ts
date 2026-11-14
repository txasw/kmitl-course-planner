// The one copy action behind every registration list control, so the selected courses
// header and the plan menu write the same lines and confirm them with the same toast.

import type { PlanEntry } from '@/lib/domain/plan';
import { formatRegistrationList } from '@/lib/export/registrationList';
import type { Locale, Translate } from '@/lib/i18n/t';
import { copyText } from '@/features/shell/copyText';

export function copyRegistrationList(
  entries: PlanEntry[],
  locale: Locale,
  t: Translate,
): void {
  copyText(
    formatRegistrationList(entries, locale, t),
    t('registration.copied'),
    t('registration.copyFailed'),
  );
}
