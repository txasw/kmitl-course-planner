// A quiet monochrome credit that rides the honesty footer row of every export poster, so a
// shared image always carries its origin. It is part of the captured composition, appears in
// every template including the transposed portraits, and is not user removable. The mark is the
// extension's own icon in a single ink-soft colour matching the credit text, sized to the text
// cap height; the ink-soft on surface pair clears the AA text bar. The mark is aria-hidden and
// the text carries the credit. The size is em relative, so it scales with the poster font size.

import { BrandMark } from '@/components/BrandMark';
import type { Translate } from '@/lib/i18n/t';

export function PosterWatermark({ t }: { t: Translate }) {
  return (
    <div
      data-poster-watermark
      className="flex shrink-0 items-center gap-1 text-[0.8em] text-ink-soft"
    >
      <BrandMark className="h-[1em] w-[1em] shrink-0" />
      <span>{t('preview.watermark')}</span>
    </div>
  );
}
