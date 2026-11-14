// The one copy action behind every copy subject id control on a placed block, so the
// detail surface and the context menu write the same id and confirm it with the same
// toast, which names the id so the student sees what landed on the clipboard.

import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import { copyText } from '@/features/shell/copyText';

export function copySubjectId(subjectId: string, t: Translate): void {
  copyText(
    subjectId,
    fillTemplate(t('block.subjectIdCopied'), { subjectId }),
    t('block.copySubjectIdFailed'),
  );
}
