// A quiet monochrome credit at the foot of every export poster, so a shared image always
// carries its origin. It rides the honesty footer position and is part of the captured
// composition, so it appears in every template including portrait and is not user
// removable. The ink-soft on surface pair clears the AA text bar; the mark is aria-hidden
// and the text carries the credit. The size is em relative, so it scales with the poster
// font size per template.

import { CalendarRange } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';

export function PosterWatermark({ t }: { t: Translate }) {
  return (
    <div
      data-poster-watermark
      className="flex shrink-0 items-center justify-end gap-1 text-[0.8em] text-ink-soft"
    >
      <CalendarRange
        size="0.9em"
        strokeWidth={2}
        aria-hidden
        className="shrink-0"
      />
      <span>{t('preview.watermark')}</span>
    </div>
  );
}
