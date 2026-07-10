// The grab affordance that follows the pointer during a drag. It is the moving
// node the drag overlay renders, which is also what dnd-kit measures for
// collision, so it is required for a drop to resolve, not only for looks. It shows
// the subject id, the section, and the lecture or practice badge in the subject's
// color, a compact echo of the row being placed.

import type { Section } from '@/lib/domain/types';
import { useTranslation } from '@/features/shell/useTranslation';
import { hashColor } from '@/lib/utils/hash-color';

export function DragCard({ section }: { section: Section }) {
  const { t } = useTranslation();
  return (
    <div
      data-drag-card
      className="inline-flex items-center gap-1.5 rounded-kcp px-2 py-1 text-xs font-medium text-white shadow-kcp"
      style={{ backgroundColor: hashColor(section.subjectId) }}
    >
      <span>{section.subjectId}</span>
      <span className="font-normal">{section.section}</span>
      <span className="rounded-[4px] bg-black/25 px-1">
        {section.kind === 'practice'
          ? t('section.practice')
          : t('section.lecture')}
      </span>
    </div>
  );
}
