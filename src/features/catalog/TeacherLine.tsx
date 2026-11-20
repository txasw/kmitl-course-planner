// The teachers of a section on one line. Most sections name one to three teachers and
// the line shows them whole; a long list rests as one line with a labelled control
// that wraps the full list in place, so no name hides behind an ellipsis without a way
// to read it (ADR-0048 amendment). It is built on the shared one line clamp the
// condition and remark lines use.

import { UserRound } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { CollapsibleLines } from './CollapsibleLines';

interface TeacherLineProps {
  teachers: string[];
  t: Translate;
}

export function TeacherLine({ teachers, t }: TeacherLineProps) {
  return (
    <CollapsibleLines
      icon={<UserRound size={12} aria-hidden className="shrink-0" />}
      label={t('section.teachers.label')}
      lines={teachers.length > 0 ? [teachers.join(', ')] : []}
      toneClass="text-ink-soft"
      expandLabel={t('section.teachers.showAll')}
      collapseLabel={t('section.teachers.hide')}
    />
  );
}
