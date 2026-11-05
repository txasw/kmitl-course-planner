// The remark of a section, such as a note on which year may enroll first or that only
// returning students are taken. It is free text from the registrar with no paired
// language, so it reads in the neutral tone and inherits the panel language. It shows
// its first line inline under the remark label, with a labelled control that reveals
// the rest; structured eligibility comes from the conditions, not from here.

import { Info } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { textLines } from '@/lib/catalog/conditions';
import { CollapsibleLines } from './CollapsibleLines';

interface RemarkLineProps {
  remark: string;
  t: Translate;
}

export function RemarkLine({ remark, t }: RemarkLineProps) {
  return (
    <CollapsibleLines
      icon={<Info size={12} aria-hidden className="shrink-0" />}
      label={t('section.remark.label')}
      lines={textLines(remark)}
      toneClass="text-ink-soft"
      expandLabel={t('section.remark.showAll')}
      collapseLabel={t('section.remark.hide')}
    />
  );
}
